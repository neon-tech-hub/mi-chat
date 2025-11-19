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
    const partnerNameDisplay = document.getElementById('partnerName');
    const partnerStatusDisplay = document.getElementById('partnerStatus');
    const myMoodButton = document.getElementById('openMoodModalChat'); 
    
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
        '😫': { text: 'Estresado/a', class: 'mood-estresado' }
    };

    // Función de utilidad para guardar datos
    const saveData = () => {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    };
    
    // Función de utilidad para obtener el texto original de un mensaje
    const getOriginalMessageText = (id) => {
        const message = currentMessages.find(m => m.id === id);
        return message ? message.text : "Mensaje original no encontrado";
    };

    // ------------------------------------------------------
    // A. RENDERIZACIÓN DE CHAT (Burbujas)
    // ------------------------------------------------------
    const renderMessage = (message) => {
        const isMe = message.sender === currentUser;
        const moodEmoji = sessionStorage.getItem("partnerMood") || "?";
        
        // 1. Crear el elemento principal
        const messageEl = document.createElement('div');
        messageEl.classList.add('chat-message');
        messageEl.classList.add(isMe ? 'me' : 'them');
        if (message.important) {
            messageEl.classList.add('important');
        }
        messageEl.dataset.messageId = message.id;

        // 2. Manejo de Respuesta (Reply)
        if (message.replyToId) {
            messageEl.classList.add('reply');
            const replyBox = document.createElement('div');
            replyBox.classList.add('reply-box');
            
            const originalText = getOriginalMessageText(message.replyToId);
            replyBox.innerHTML = `
                <p class="reply-sender">${isMe ? 'Respondiendo a: ' + partnerName : 'Respondiendo a: ' + currentUser}</p>
                <p class="reply-text">${originalText}</p>
            `;
            messageEl.appendChild(replyBox);
        }

        // 3. Contenido del mensaje
        const contentEl = document.createElement('div');
        contentEl.classList.add('message-content');
        contentEl.textContent = message.text;
        messageEl.appendChild(contentEl);

        // 4. Meta Info (Hora y estado de lectura/important)
        const metaEl = document.createElement('div');
        metaEl.classList.add('meta-info');
        
        // Formato de hora simple
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        metaEl.innerHTML = `<span>${time}</span>`;

        if (isMe) {
            // Icono de estado de lectura/envío
            const statusIcon = document.createElement('span');
            statusIcon.classList.add('status-icon');
            statusIcon.innerHTML = '✔️'; // Enviado
            if (message.read) {
                statusIcon.classList.add('read');
                statusIcon.innerHTML = '✔️✔️'; // Leído
            }
            metaEl.appendChild(statusIcon);
        } else {
             // Mostrar el mood de la pareja junto a su mensaje (opcional, pero puede ser útil)
             const moodIcon = document.createElement('span');
             moodIcon.classList.add('mood-icon');
             moodIcon.textContent = moodEmoji;
             metaEl.prepend(moodIcon);
        }

        messageEl.appendChild(metaEl);

        return messageEl;
    };
    
    const renderMessages = (messages) => {
        messageContainer.innerHTML = ''; // Limpiar el contenedor
        messages.forEach(msg => {
            messageContainer.appendChild(renderMessage(msg));
        });
        messageContainer.scrollTop = messageContainer.scrollHeight; // Scroll al final
    };

    // ------------------------------------------------------
    // B. MANEJO DE ESTADOS/UI
    // ------------------------------------------------------
    
    // Actualizar la vista del estado de la pareja
    const updatePartnerStatusDisplay = (mood, status) => {
        const moodInfo = MOODS[mood] || { text: 'Desconocido', class: 'mood-default' };
        
        partnerStatusDisplay.textContent = moodInfo.text;
        partnerNameDisplay.textContent = partnerName; 

        if (status === 'online') {
            partnerStatusDisplay.textContent = `Online (${moodInfo.text})`;
            partnerStatusDisplay.style.color = 'var(--primary)';
        } else if (status === 'paused') {
            partnerStatusDisplay.textContent = `Pausado (${moodInfo.text})`;
            partnerStatusDisplay.style.color = 'var(--important)';
        } else { // offline
            partnerStatusDisplay.textContent = 'Desconectado';
            partnerStatusDisplay.style.color = 'var(--muted)';
        }
    };
    
    // Renderizar los botones de mood en el modal
    const renderMoods = () => {
        const moodOptionsContainer = document.getElementById('moodOptions');
        if (!moodOptionsContainer) return;

        moodOptionsContainer.innerHTML = '';
        Object.keys(MOODS).forEach(emoji => {
            const mood = MOODS[emoji];
            const button = document.createElement('button');
            button.classList.add('mood-btn', mood.class);
            button.textContent = emoji;
            button.title = mood.text;
            button.dataset.mood = emoji;
            
            button.addEventListener('click', () => {
                // Actualizar mi mood local
                sessionStorage.setItem("myMood", emoji);
                myMoodButton.textContent = emoji;
                // Cerrar modal
                document.getElementById('moodsContainer').classList.remove('active');
                
                // Emitir a servidor
                socket.emit('changeMood', { mood: emoji });
            });

            moodOptionsContainer.appendChild(button);
        });
    };
    
    // Actualiza el emoji del botón del estado de ánimo
    const updateMyMoodButton = (mood) => {
        if (myMoodButton) {
            myMoodButton.textContent = mood;
        }
    };
    
    // ------------------------------------------------------
    // C. MANEJO DE INPUT Y ENVÍO DE MENSAJES
    // ------------------------------------------------------
    
    const resetReplyState = () => {
        replyingToId = null;
        replyingToContainer.style.display = 'none';
        replyingToText.textContent = '';
    };

    const handleSendMessage = () => {
        const text = messageInput.value.trim();
        if (text === '') return;

        const messageId = Date.now().toString(); // ID único
        const newMessage = {
            id: messageId,
            text: text,
            sender: currentUser,
            timestamp: new Date().toISOString(),
            read: false,
            important: false,
            replyToId: replyingToId // Agrega el ID si es una respuesta
        };

        // 1. Guardar mensaje localmente
        currentMessages.push(newMessage);
        chats[currentChat] = currentMessages;
        saveData();

        // 2. Renderizar y hacer scroll
        renderMessages(currentMessages);
        
        // 3. Emitir a servidor
        socket.emit('messageSent', { chatKey: currentChat, message: newMessage });

        // 4. Limpiar input y estado de respuesta
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Resetear la altura del textarea
        sendMessageBtn.disabled = true;
        resetReplyState();
    };

    // Habilitar/deshabilitar botón de enviar
    messageInput.addEventListener('input', () => {
        const text = messageInput.value.trim();
        sendMessageBtn.disabled = text === '';
        
        // Auto-resize del textarea
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // Enviar al presionar Enter (sin shift)
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    sendMessageBtn.addEventListener('click', handleSendMessage);
    cancelReplyBtn.addEventListener('click', resetReplyState);

    // ------------------------------------------------------
    // D. MANEJO DE ACCIONES DE MENSAJE (Long Press)
    // ------------------------------------------------------
    let selectedMessageId = null;
    const messageActionsModal = document.getElementById('messageActionsModal');
    const selectedMessageText = document.getElementById('selectedMessageText');
    const replyMessageBtn = document.getElementById('replyMessageBtn');
    const markImportantBtn = document.getElementById('markImportantBtn');
    
    // Abre el modal de acciones
    const openMessageActionsModal = (messageId, text, isMine) => {
        selectedMessageId = messageId;
        selectedMessageText.textContent = text;
        
        // Solo permitir marcar como importante si es mío (o del otro si se quiere permitir)
        // Por simplicidad, se permite responder y marcar desde el modal, pero solo
        // tendrá efecto de *marcado* si el mensaje es del otro.
        // Mejor: solo permitir responder a mensajes del otro, y marcar como importante ambos.
        const message = currentMessages.find(m => m.id === messageId);
        
        // Si el mensaje ya es importante, cambiar el texto del botón
        if (message && message.important) {
             markImportantBtn.textContent = "⭐️ Importante (Ya marcado)";
             markImportantBtn.disabled = true;
        } else {
             markImportantBtn.textContent = "🌟 Marcar como importante";
             markImportantBtn.disabled = false;
        }
        
        // Si el mensaje es mío, no tiene sentido responder a mí mismo en este contexto.
        replyMessageBtn.disabled = isMine;
        
        messageActionsModal.classList.add('active');
    };
    
    // Evento de "longpress" (presión larga)
    messageContainer.addEventListener('longpress', (e) => {
        const messageElement = e.target.closest('.chat-message');
        if (!messageElement) return;
        
        const messageId = messageElement.dataset.messageId;
        const message = currentMessages.find(m => m.id === messageId);
        if (!message) return;

        openMessageActionsModal(messageId, message.text, message.sender === currentUser);
    });

    // Acción de Responder
    replyMessageBtn.addEventListener('click', () => {
        if (selectedMessageId) {
            const originalMessage = currentMessages.find(m => m.id === selectedMessageId);
            if (originalMessage) {
                replyingToId = selectedMessageId;
                replyingToText.textContent = `Respondiendo a: "${originalMessage.text.substring(0, 30)}..."`;
                replyingToContainer.style.display = 'flex';
                messageInput.focus();
                
                messageActionsModal.classList.remove('active');
            }
        }
    });

    // Acción de Marcar como Importante
    markImportantBtn.addEventListener('click', () => {
        if (selectedMessageId) {
            const messageIndex = currentMessages.findIndex(m => m.id === selectedMessageId);
            if (messageIndex !== -1 && !currentMessages[messageIndex].important) {
                // 1. Marcar localmente
                currentMessages[messageIndex].important = true;
                chats[currentChat] = currentMessages;
                saveData();
                
                // 2. Renderizar (para que aparezca el estilo 'important')
                renderMessages(currentMessages);

                // 3. Notificar al servidor/pareja (si el mensaje es del otro)
                const message = currentMessages[messageIndex];
                if (message.sender === partnerName) {
                    socket.emit('markImportant', { chatId: currentChat, messageId: selectedMessageId });
                }
            }
            messageActionsModal.classList.remove('active');
        }
    });

    // Implementación de Long Press (para touch y mouse)
    (function setupLongPress() {
        const LONG_PRESS_THRESHOLD = 500; // 500ms
        let pressTimer;
        const messagesContainer = document.getElementById('messageContainer');

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


    // ------------------------------------------------------
    // E. MANEJO DE SOCKETS (Recepción de Eventos)
    // ------------------------------------------------------
    
    // 1. Conexión y Solicitud de Estado
    socket.on('connect', () => {
        console.log("Conectado al servidor de sockets.");
        // Al conectarse, unirse al chat del usuario y notificar login para obtener estado.
        socket.emit('userLogin', currentUser);
        socket.emit('requestPartnerStatus', { targetUser: partnerName });
    });
    
    // 2. Recepción de Nuevo Mensaje
    socket.on("newMessage", (data) => {
        if (data.sender !== getPartnerName() || data.chatKey !== currentChat) return; // Ignorar si no es de la pareja o no es el chat actual
        
        const newMessage = { ...data.message, sender: data.sender, read: true }; // Se marca como leído al recibirlo
        
        currentMessages.push(newMessage);
        chats[currentChat] = currentMessages;
        saveData();
        
        renderMessages(currentMessages);
        
        // Notificar al servidor que se ha leído (para el doble check en el lado del remitente)
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    });

    // 3. Cambio de Estado de Ánimo de la pareja
    socket.on("moodChanged", (data) => {
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood);
            updatePartnerStatusDisplay(data.mood, partnerStatus);
        }
    });

    // 4. Recepción de Estado (Online/Offline/Paused)
    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
            partnerStatus = data.status; // Actualizar el estado local
        }
    });
    
    // 4.1. Recepción del Estado Completo (al cargar la página)
    socket.on('partnerStatus', (data) => {
        if (data.user === partnerName) {
            sessionStorage.setItem("partnerMood", data.mood);
            updatePartnerStatusDisplay(data.mood, data.status);
            partnerStatus = data.status;
        }
    });
    
    // 5. Recepción de Checks de Lectura
    socket.on("messagesRead", (data) => {
        if (data.reader === getPartnerName() && data.chatKey === currentChat) {
            let changed = false;
            // Marcar todos mis mensajes como leídos
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
                renderMessages(currentMessages); 
            }
        }
    });
    
    // 6. Recepción de Mensaje Marcado como Importante
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
    
    // Asignar nombre del chat
    partnerNameDisplay.textContent = currentChat.charAt(0).toUpperCase() + currentChat.slice(1);
    
    // Configurar botón de volver
    document.getElementById('backToMain').addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
    
    // Cargar y Renderizar mensajes existentes
    if (chats[currentChat]) {
        renderMessages(chats[currentChat]);
        // Emitir 'readChat' al cargar la conversación
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    }
    
    // Inicializar el estado de la pareja y mi mood en la UI
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline');
    updateMyMoodButton(sessionStorage.getItem("myMood") || "😴");
    
    // Eventos del Modal de Mood (usa los mismos IDs y lógica que menu.js)
    document.getElementById('openMoodModalChat').addEventListener('click', () => {
        document.getElementById('moodsContainer').classList.add('active');
    });
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.modalTarget;
            if (targetId) {
                document.getElementById(targetId).classList.remove('active');
            }
        });
    });
    renderMoods();

})(); // Fin de la función anónima.