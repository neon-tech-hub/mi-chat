// =======================================================
// chat.js
// Lógica para la VISTA DE CONVERSACIÓN ÚNICA
// =======================================================

(function () {
    // -------------------\
    // VARIABLES Y UTILIDADES
    // -------------------\
    const currentUser = sessionStorage.getItem("currentUser");
    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    // ✅ CORRECTO: Obtiene la clave del chat (ej: 'discutir') del URL
    let currentChat = new URLSearchParams(window.location.search).get('chatKey'); 
    
    if (!currentChat) {
        window.location.href = "menu.html"; // Redirigir si no hay chatKey
        return;
    }

    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; 
    let replyingToId = null; 
    let currentMessages = chats[currentChat] || [];
    
    // Elementos del DOM
    const messageContainer = document.getElementById('messageContainer');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const replyingToContainer = document.getElementById('replyingToContainer');
    const replyingToText = document.getElementById('replyingToText');
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');
    
    // Variables para Socket.IO 🟢 CORRECCIÓN: Usar la URL de Render
    const SERVER_URL = 'https://mi-chat-omr7.onrender.com';
    const socket = io(SERVER_URL); 

    // Mapeo de estados y colores (debe coincidir con CSS y menu.js)
    const MOODS = {
        '😍': { text: 'Enamorado', class: 'mood-enamorado' },
        '😊': { text: 'Feliz', class: 'mood-happy' },
        '😴': { text: 'Cansado/a', class: 'mood-cansado' },
        '😡': { text: 'Enojado/a', class: 'mood-enojado' },
        '😔': { text: 'Triste', class: 'mood-triste' },
        '😫': { text: 'Estresado/a', class: 'mood-estresado' },
        '🤯': { text: 'Ansioso/a', class: 'mood-ansioso' },
        '😐': { text: 'Neutral', class: 'mood-neutral' }
    };

    // -------------------\
    // MANEJO DE ALMACENAMIENTO Y UTILIDADES
    // -------------------\
    function saveData() {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    }
    
    function generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }
    
    function getMessageById(id) {
        return currentMessages.find(m => m.id === id);
    }
    
    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }

    // -------------------\
    // RENDERIZADO DE INTERFAZ
    // -------------------\
    
    function updatePartnerStatusDisplay(mood, status) {
        const moodEmoji = document.getElementById('partnerMoodEmojiChat');
        const statusHeader = document.getElementById('partnerStatus');
        const partnerMoodDisplay = document.getElementById('partnerMoodDisplayChat');
        
        partnerMood = mood;
        partnerStatus = status;
        sessionStorage.setItem("partnerMood", partnerMood);
        
        if (moodEmoji) moodEmoji.textContent = mood;
        
        // Aplicar el color de estado de ánimo al círculo de la pareja
        if (partnerMoodDisplay) {
            partnerMoodDisplay.className = 'partner-mood-display ' + (MOODS[mood] ? MOODS[mood].class : 'mood-neutral');
        }

        if (statusHeader) {
            if (status === 'online') {
                statusHeader.textContent = `En línea (${MOODS[mood]?.text || '?'})`;
                statusHeader.classList.remove('offline');
                statusHeader.classList.add('online');
            } else if (status === 'paused') {
                statusHeader.textContent = `Chat en pausa`;
                statusHeader.classList.add('offline');
                statusHeader.classList.remove('online');
            } else { // offline
                statusHeader.textContent = `Desconectado`;
                statusHeader.classList.add('offline');
                statusHeader.classList.remove('online');
            }
        }
    }

    function renderMessages(messages) {
        messageContainer.innerHTML = '';
        currentMessages = messages; // Asegurar que currentMessages esté sincronizado
        
        messages.forEach((msg, index) => {
            const isMe = msg.sender === currentUser;
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message ${isMe ? 'me' : 'them'} ${msg.important ? 'important' : ''}`;
            messageElement.setAttribute('data-message-id', msg.id);
            
            let replyHtml = '';
            if (msg.replyToId) {
                const repliedMsg = getMessageById(msg.replyToId);
                const repliedText = repliedMsg ? repliedMsg.text.substring(0, 50) + (repliedMsg.text.length > 50 ? '...' : '') : 'Mensaje original...';
                const repliedSender = repliedMsg ? (repliedMsg.sender === currentUser ? 'Tú' : partnerName) : 'Mensaje eliminado';
                replyHtml = `
                    <div class="reply-box">
                        <span class="reply-sender">${repliedSender}</span>
                        <span class="reply-text">${repliedText}</span>
                    </div>
                `;
            }

            // El estado de lectura solo se muestra en mensajes propios
            let statusIcon = '';
            if (isMe) {
                statusIcon = `<span class="status-icon ${msg.read ? 'read' : ''}">${msg.read ? '✓✓' : '✓'}</span>`;
            }

            messageElement.innerHTML = `
                ${replyHtml}
                <div class="message-content">${msg.text}</div>
                <div class="meta-info">
                    ${msg.important ? '🌟' : ''}
                    <span class="timestamp">${formatTime(msg.timestamp)}</span>
                    ${statusIcon}
                </div>
            `;
            
            // Añadir el listener para el modal de acciones de mensaje
            messageElement.addEventListener('longpress', (e) => openMessageActionsModal(msg));
            
            // Fallback para click si no hay 'longpress'
            messageElement.addEventListener('click', (e) => {
                // Prevenir que se abra el modal si ya se abrió con longpress
                if (!e.defaultPrevented) openMessageActionsModal(msg);
            });
            
            messageContainer.appendChild(messageElement);
        });
        
        // Autoscroll al final
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    // -------------------\
    // MANEJADORES DE EVENTOS
    // -------------------\
    
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        const message = {
            id: generateMessageId(),
            text: text,
            timestamp: Date.now(),
            sender: currentUser,
            read: false,
            important: false,
            replyToId: replyingToId // Será null si no se está respondiendo
        };

        // 1. Guardar localmente
        currentMessages.push(message);
        chats[currentChat] = currentMessages;
        saveData();

        // 2. Renderizar (para que aparezca inmediatamente)
        renderMessages(currentMessages);
        
        // 3. Emitir al servidor
        socket.emit("sendMessage", {
            chatId: currentChat,
            message: {
                id: message.id,
                text: message.text,
                timestamp: message.timestamp,
                replyToId: message.replyToId
            }
        });
        
        // 4. Limpiar input y estado de respuesta
        messageInput.value = '';
        sendMessageBtn.disabled = true;
        
        if (replyingToId) {
            clearReplyContext();
        }
    }
    
    function handleInput() {
        sendMessageBtn.disabled = messageInput.value.trim() === '';
        // Autosize de textarea
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    }
    
    function openMessageActionsModal(message) {
        const modal = document.getElementById('messageActionsModal');
        const selectedMessageText = document.getElementById('selectedMessageText');
        const replyBtn = document.getElementById('replyMessageBtn');
        const markBtn = document.getElementById('markImportantBtn');
        
        // Actualizar el texto del modal
        selectedMessageText.textContent = `"${message.text.substring(0, 80) + (message.text.length > 80 ? '...' : '')}"`;
        
        // Limpiar handlers anteriores
        replyBtn.replaceWith(replyBtn.cloneNode(true));
        markBtn.replaceWith(markBtn.cloneNode(true));
        const newReplyBtn = document.getElementById('replyMessageBtn');
        const newMarkBtn = document.getElementById('markImportantBtn');
        
        // Configurar botón de Responder
        newReplyBtn.addEventListener('click', () => {
            setReplyContext(message.id, message.text);
            modal.classList.remove('active');
        });
        
        // Configurar botón de Marcar como Importante
        if (message.important) {
            newMarkBtn.textContent = '✅ Marcado como importante';
            newMarkBtn.disabled = true;
        } else {
            newMarkBtn.textContent = '🌟 Marcar como importante';
            newMarkBtn.disabled = false;
            newMarkBtn.addEventListener('click', () => {
                markMessageImportant(message.id);
                modal.classList.remove('active');
            });
        }
        
        modal.classList.add('active');
    }
    
    function setReplyContext(messageId, messageText) {
        replyingToId = messageId;
        replyingToText.textContent = `Respondiendo a: "${messageText.substring(0, 30)}..."`;
        replyingToContainer.classList.add('active');
        messageInput.focus();
    }
    
    function clearReplyContext() {
        replyingToId = null;
        replyingToText.textContent = '';
        replyingToContainer.classList.remove('active');
    }
    
    function markMessageImportant(messageId) {
        // 1. Marcar localmente
        const messageIndex = currentMessages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            currentMessages[messageIndex].important = true;
            chats[currentChat] = currentMessages;
            saveData();
            renderMessages(currentMessages); // Re-renderizar para mostrar la estrella
            
            // 2. Emitir al servidor
            socket.emit('markImportant', {
                chatId: currentChat,
                messageId: messageId 
            });
        }
    }
    
    // Asignación de Event Listeners
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('input', handleInput);
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    cancelReplyBtn.addEventListener('click', clearReplyContext);
    
    document.getElementById('backToMain')?.addEventListener('click', () => {
        // Limpiar el chat actual al volver al menú
        sessionStorage.removeItem('currentChatDate'); 
        window.location.href = 'menu.html';
    });
    
    // Manejador de Modales
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalTarget = e.target.getAttribute('data-modal-target') || e.target.closest('.modal-backdrop').id;
            if (modalTarget) {
                document.getElementById(modalTarget).classList.remove('active');
            }
        });
    });
    

    // -------------------\
    // MANEJADORES DE SOCKET.IO (RECEPCIÓN)
    // -------------------\
    
    // 1. Conexión y Registro
    socket.on("connect", () => {
        // Registrar el usuario y el mood (obtenido desde session storage)
        const myMood = sessionStorage.getItem("myMood") || '😴';
        socket.emit("registerUser", { user: currentUser, mood: myMood });
        
        // Solicitar estado de la pareja
        socket.emit('requestPartnerStatus', { target: partnerName });
        
        // Al estar en el chat, marcamos los mensajes como leídos
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    });
    
    // 2. Recepción de un Nuevo Mensaje
    socket.on("newMessage", (data) => {
        if (data.sender === partnerName && data.chatId === currentChat) {
            const message = { 
                ...data.message, 
                sender: data.sender, 
                read: false,
                important: false // Se inicializa como no importante
            };
            currentMessages.push(message);
            chats[currentChat] = currentMessages;
            saveData();
            renderMessages(currentMessages);
            
            // Auto-emitir lectura al recibir un mensaje si el chat está abierto
            socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
        }
    });

    // 3. Recepción de Mensajes Leídos
    socket.on("messagesRead", (data) => {
        if (data.reader === partnerName && data.chatKey === currentChat) {
            let changed = false;
            // Marcar como leídos todos los mensajes propios que no lo estén
            currentMessages = currentMessages.map(msg => {
                if (msg.sender === currentUser && !msg.read) {
                    msg.read = true;
                    changed = true;
                }
                return msg;
            });
            
            if (changed) {
                chats[currentChat] = currentMessages;
                saveData();
                renderMessages(currentMessages); // Re-renderizar solo si hubo cambios
            }
        }
    });
    
    // 4. Recepción de Cambio de Estado (Online/Offline/Paused)
    socket.on("statusChanged", (data) => { 
        if (data.sender === partnerName) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });
    
    // 5. Recepción de Cambio de Estado de Ánimo
    socket.on("moodChanged", (data) => {
        if (data.sender === partnerName) {
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });
    
    // 6. Recepción de Mensaje Marcado como Importante
    socket.on("messageMarked", (data) => {
        if (data.sender === partnerName && data.chatId === currentChat) {
            const messageIndex = currentMessages.findIndex(m => m.id === data.messageId);
            if (messageIndex !== -1) {
                currentMessages[messageIndex].important = true;
                chats[currentChat] = currentMessages;
                saveData();
                renderMessages(currentMessages);
            }
        }
    });
    
    // 7. Recepción de estado inicial de la pareja
    socket.on('partnerStatus', (data) => {
        if (data.user === partnerName) {
            updatePartnerStatusDisplay(data.mood, data.status);
        }
    });


    // =======================================================
    // F. INICIALIZACIÓN DE chat.html
    // =======================================================

    // Cargar y Renderizar mensajes existentes
    if (chats[currentChat]) {
        renderMessages(chats[currentChat]);
        // Emitir 'readChat' al cargar la conversación
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    }
    
    // Inicializar el estado de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline');
    
    // Inicializar el botón de mi estado de ánimo en el header del chat
    const myMood = sessionStorage.getItem("myMood") || "😴";
    const myMoodBtn = document.getElementById('openMoodModalChat');
    if (myMoodBtn) {
        myMoodBtn.textContent = myMood;
        myMoodBtn.className = 'my-mood-btn ' + (MOODS[myMood] ? MOODS[myMood].class : '');
    }
    
    // Simulación de 'longpress'
    (function () {
        let pressTimer;
        const messagesContainer = document.getElementById('messageContainer');
        const LONG_PRESS_THRESHOLD = 500; // 500ms

        messagesContainer.addEventListener('touchstart', (e) => {
            const messageElement = e.target.closest('.chat-message');
            if (messageElement) {
                pressTimer = setTimeout(() => {
                    e.preventDefault(); // Prevenir el comportamiento por defecto (scroll)
                    messageElement.dispatchEvent(new Event('longpress', { bubbles: true }));
                }, LONG_PRESS_THRESHOLD);
            }
        }, true); // Usar captura

        messagesContainer.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        }, true);

        messagesContainer.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        }, true);
        
        // Agregar compatibilidad para mousedown/mouseup en desktop
        messagesContainer.addEventListener('mousedown', (e) => {
            const messageElement = e.target.closest('.chat-message');
            if (messageElement) {
                pressTimer = setTimeout(() => {
                    e.preventDefault(); 
                    messageElement.dispatchEvent(new Event('longpress', { bubbles: true }));
                }, LONG_PRESS_THRESHOLD);
            }
        }, true); 

        messagesContainer.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        }, true);

        messagesContainer.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        }, true);
    })();


})(); // Fin de la función anónima.