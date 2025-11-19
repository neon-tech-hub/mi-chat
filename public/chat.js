// =======================================================
// chat.js
// Lógica para la VISTA DE CONVERSACIÓN ÚNICA
// =======================================================

(function () {
    // -------------------
    // VARIABLES Y UTILIDADES
    // -------------------
    const currentUser = sessionStorage.getItem("currentUser");
    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    // ✅ CORRECTO: Obtiene la clave del chat (ej: 'discutir') del URL
    let currentChat = new URLSearchParams(window.location.search).get('chatKey'); 
    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; 
    let replyingToId = null; 
    let currentMessages = chats[currentChat] || [];
    
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
        '💬': { text: 'Quiero Hablar', class: 'mood-porhablar' },
    };

    const getPartnerName = () => partnerName;

    // Función para obtener la hora formateada
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    // Función de guardado de datos
    const saveData = () => {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    };

    // Función para generar un ID único (para mensajes)
    const generateMessageId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    // -------------------
    // ELEMENTOS DEL DOM
    // -------------------
    const partnerNameDisplay = document.getElementById("partnerName");
    const partnerStatusDisplay = document.getElementById("partnerStatus");
    const messageContainer = document.getElementById("messageContainer");
    const messageInput = document.getElementById("messageInput");
    const sendMessageBtn = document.getElementById("sendMessageBtn");
    const backToMainBtn = document.getElementById("backToMain");
    const replyingToContainer = document.getElementById("replyingToContainer");
    const replyingToText = document.getElementById("replyingToText");
    const cancelReplyBtn = document.getElementById("cancelReplyBtn");
    
    // Modales y botones de acción
    const messageActionsModal = document.getElementById("messageActionsModal");
    const selectedMessageText = document.getElementById("selectedMessageText");
    const replyMessageBtn = document.getElementById("replyMessageBtn");
    const markImportantBtn = document.getElementById("markImportantBtn");
    const openMoodModalChat = document.getElementById("openMoodModalChat");

    // -------------------
    // RENDERIZADO
    // -------------------

    const updatePartnerStatusDisplay = (mood, status) => {
        partnerStatus = status;

        partnerNameDisplay.textContent = currentChat.charAt(0).toUpperCase() + currentChat.slice(1);
        
        let text = "";
        let classList = "";

        if (status === 'paused') {
            text = `Chat Pausado por ${partnerName}`;
            classList = "status-paused";
        } else if (status === 'online') {
            text = `En línea: ${MOODS[mood]?.text || "Desconocido"}`;
            classList = MOODS[mood]?.class || "status-online";
        } else { // 'offline'
            text = `${partnerName} Desconectado/a`;
            classList = "status-offline";
        }

        partnerStatusDisplay.textContent = text;
        partnerStatusDisplay.className = `partner-status ${classList}`;
    };

    const renderMessages = (messages) => {
        messageContainer.innerHTML = '';
        currentMessages = messages; 

        messages.forEach(message => {
            const isMe = message.sender === currentUser;
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message ${isMe ? 'me' : 'them'} ${message.important ? 'important' : ''}`;
            messageElement.dataset.messageId = message.id;

            // Lógica de respuesta (reply)
            let replyHtml = '';
            if (message.replyToId) {
                const repliedMsg = messages.find(m => m.id === message.replyToId);
                const repliedText = repliedMsg ? repliedMsg.text.substring(0, 40) + (repliedMsg.text.length > 40 ? '...' : '') : 'Mensaje original...';
                const repliedSender = repliedMsg?.sender === currentUser ? 'Tú' : partnerName;
                replyHtml = `
                    <div class="reply-box">
                        <span class="reply-sender">${repliedSender}</span>
                        <span class="reply-text">${repliedText}</span>
                    </div>
                `;
                messageElement.classList.add('reply');
            }

            // Contenido del mensaje
            const textContent = message.text.replace(/\n/g, '<br>');
            const messageContentHtml = `<div class="message-content">${replyHtml}${textContent}</div>`;

            // Metadatos
            let statusIcon = '';
            if (isMe) {
                statusIcon = `<span class="status-icon ${message.read ? 'read' : 'sent'}">✓</span>`;
                if (message.read) {
                    statusIcon = `<span class="status-icon read">✓✓</span>`;
                }
            }

            const metaHtml = `
                <div class="meta-info">
                    ${message.important ? '🌟' : ''}
                    ${formatTime(message.timestamp)}
                    ${statusIcon}
                </div>
            `;
            
            messageElement.innerHTML = messageContentHtml + metaHtml;

            messageElement.addEventListener('click', (e) => {
                if (!isMe) return; // Solo permitir acciones en mis propios mensajes
                
                // Abrir modal de acciones
                if (messageActionsModal) {
                    selectedMessageText.textContent = message.text;
                    messageActionsModal.dataset.selectedId = message.id;
                    messageActionsModal.classList.add('active');
                }
            });

            messageContainer.appendChild(messageElement);
        });

        // Asegurarse de que el chat esté al final
        messageContainer.scrollTop = messageContainer.scrollHeight;
    };

    // -------------------
    // MANEJO DE EVENTOS
    // -------------------

    // 1. Botón de Volver al Menú
    if (backToMainBtn) {
        backToMainBtn.addEventListener('click', () => {
            window.location.href = "menu.html";
        });
    }

    // 2. Input de Mensaje
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            // Habilitar/Deshabilitar el botón de enviar
            sendMessageBtn.disabled = messageInput.value.trim() === '';
            
            // Ajuste de altura del textarea (para que crezca con el texto)
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
        });

        // Enviar al presionar Enter (si no se presiona Shift)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendMessageBtn.disabled) {
                    sendMessageBtn.click();
                }
            }
        });
    }

    // 3. Botón de Enviar Mensaje
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', () => {
            const text = messageInput.value.trim();
            if (!text) return;
            
            const newMessage = {
                id: generateMessageId(),
                text: text,
                sender: currentUser,
                timestamp: Date.now(),
                read: false,
                important: false,
                replyToId: replyingToId,
            };

            // 1. Agregar a la lista de mensajes local
            if (!chats[currentChat]) {
                chats[currentChat] = [];
            }
            chats[currentChat].push(newMessage);
            currentMessages = chats[currentChat];
            saveData();
            
            // 2. Renderizar y limpiar
            renderMessages(currentMessages);
            messageInput.value = '';
            sendMessageBtn.disabled = true;
            messageInput.style.height = 'auto'; // Resetear altura
            
            // 3. Limpiar respuesta
            replyingToId = null;
            replyingToContainer.classList.remove('active');

            // 4. Enviar por Socket.IO
            socket.emit('messageSent', {
                sender: currentUser,
                chatKey: currentChat,
                message: newMessage
            });
        });
    }
    
    // 4. Botones del Modal de Acciones
    if (replyMessageBtn) {
        replyMessageBtn.addEventListener('click', () => {
            replyingToId = messageActionsModal.dataset.selectedId;
            const repliedMsg = currentMessages.find(m => m.id === replyingToId);
            if (repliedMsg) {
                const repliedText = repliedMsg.text.substring(0, 40) + (repliedMsg.text.length > 40 ? '...' : '');
                replyingToText.textContent = `Respondiendo a: "${repliedText}"`;
                replyingToContainer.classList.add('active');
            }
            messageActionsModal.classList.remove('active');
        });
    }
    
    if (markImportantBtn) {
        markImportantBtn.addEventListener('click', () => {
            const messageId = messageActionsModal.dataset.selectedId;
            const messageIndex = currentMessages.findIndex(m => m.id === messageId);
            
            if (messageIndex !== -1) {
                currentMessages[messageIndex].important = true;
                chats[currentChat] = currentMessages;
                saveData();
                renderMessages(currentMessages);
                
                // Notificar al servidor
                socket.emit('markImportant', {
                    sender: currentUser,
                    chatId: currentChat,
                    messageId: messageId
                });
            }
            messageActionsModal.classList.remove('active');
        });
    }
    
    // 5. Botón de Cancelar Respuesta
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            replyingToId = null;
            replyingToContainer.classList.remove('active');
        });
    }
    
    // 6. Cierre de Modales
    document.querySelectorAll('.close-modal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.target.closest('.close-modal-btn');
            if (!target) return;
            
            const targetId = target.dataset.modalTarget;
            const modalElement = document.getElementById(targetId);
            if (modalElement) {
                modalElement.classList.remove('active');
            }
        });
    });

    // -------------------
    // LÓGICA DE SOCKET.IO
    // -------------------
    
    socket.on('connect', () => {
        console.log("Socket.IO conectado en Chat:", socket.id);
        
        socket.emit('userConnected', { 
            user: currentUser, 
            mood: sessionStorage.getItem("myMood") || '😴',
        });

        socket.emit('requestPartnerStatus', { targetUser: partnerName });
    });

    // 1. Recepción de un nuevo mensaje
    socket.on("newMessage", (data) => {
        if (data.sender === getPartnerName() && data.chatKey === currentChat) {
            
            // 1. Agregar y guardar
            if (!chats[currentChat]) {
                chats[currentChat] = [];
            }
            chats[currentChat].push({ ...data.message, sender: data.sender, read: true }); 
            currentMessages = chats[currentChat];
            saveData();
            
            // 2. Renderizar y notificar que se leyó
            renderMessages(currentMessages);
            socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
        }
    });

    // 2. Sincronización de estado de lectura (el mensaje de la pareja se marca como "leído")
    socket.on("messagesRead", (data) => {
        if (data.reader === getPartnerName() && data.chatKey === currentChat) {
            let changed = false;
            
            currentMessages = currentMessages.map(msg => {
                // Solo marcamos como leído si yo soy el remitente (el mensaje 'me') y no estaba ya leído
                if (msg.sender === currentUser && !msg.read) {
                    msg.read = true;
                    changed = true;
                }
                return msg;
            });
            
            if (changed) {
                chats[currentChat] = currentMessages;
                saveData();
                renderMessages(currentMessages); 
            }
        }
    });

    // 3. Recepción de Cambio de Ánimo
    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            updatePartnerStatusDisplay(data.mood, 'online'); // Forzar a online al recibir mood
        }
    });

    // 4. Recepción de Cambio de Estado (Online/Offline/Paused)
    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });
    
    // 5. Recepción de Mensaje Marcado como Importante
    socket.on("messageMarked", (data) => {
        if (data.sender === getPartnerName() && data.chatId === currentChat) {
            const messageIndex = currentMessages.findIndex(m => m.id === data.messageId);
            if (messageIndex !== -1) {
                currentMessages[messageIndex].important = true;
                chats[currentChat] = currentMessages;
                saveData();
                renderMessages(currentMessages);
            }
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
    
})(); // Fin del IIFE