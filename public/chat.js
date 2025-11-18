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
    let currentChat = new URLSearchParams(window.location.search).get('chatKey'); // 🔴 Leer chatKey de la URL
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
    const saveData = () => {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    };

    // Elementos del DOM
    const messageContainer = document.getElementById("messageContainer");
    const messageInput = document.getElementById("messageInput");
    const sendMessageBtn = document.getElementById("sendMessageBtn");
    const partnerNameDisplay = document.getElementById("partnerName");
    const partnerStatusDisplay = document.getElementById("partnerStatus");
    const backToMainBtn = document.getElementById("backToMain");
    const replyingToContainer = document.getElementById("replyingToContainer");
    const replyingToText = document.getElementById("replyingToText");
    const cancelReplyBtn = document.getElementById("cancelReplyBtn");

    // =======================================================
    // B. FUNCIONES DE UI Y RENDERIZADO
    // =======================================================

    // Actualiza la visualización del estado de la pareja
    const updatePartnerStatusDisplay = (mood, status) => {
        partnerStatus = status; // Actualiza el estado local
        let text = "";
        
        if (status === 'paused') {
            text = `⏸️ Chat Pausado por ${getPartnerName()}`;
            partnerStatusDisplay.className = `partner-status status-paused`;
        } else if (status === 'online') {
            text = `${mood} ${MOODS[mood]?.text || "En línea"}`;
            partnerStatusDisplay.className = `partner-status status-online`;
        } else { // 'offline'
            text = "Desconectado/a 😴";
            partnerStatusDisplay.className = `partner-status status-offline`;
        }
        partnerStatusDisplay.textContent = text;
        
        // Habilitar/deshabilitar el área de input si la pareja pausó
        if (messageInput) {
            messageInput.disabled = status === 'paused';
            sendMessageBtn.disabled = status === 'paused' || messageInput.value.trim().length === 0;
            messageInput.placeholder = status === 'paused' ? "El chat está pausado..." : "Escribí un mensaje...";
        }
    };
    
    // Renderiza el contenido del chat
    const renderMessages = (messages) => {
        messageContainer.innerHTML = '';
        currentMessages = messages;
        
        messages.forEach(msg => {
            const messageElement = document.createElement("div");
            messageElement.className = `chat-message ${msg.sender === currentUser ? 'me' : 'them'} ${msg.important ? 'important' : ''}`;
            messageElement.dataset.messageId = msg.id;
            
            let htmlContent = `<div class="text-content">${msg.text}</div>`;
            
            // Si es una respuesta, agregar la caja de respuesta
            if (msg.replyTo) {
                const originalMsg = messages.find(m => m.id === msg.replyTo);
                const replyText = originalMsg ? originalMsg.text : 'Mensaje original...';
                
                htmlContent = `
                    <div class="reply-box">
                        <div class="reply-header">Respondiendo a:</div>
                        <div class="reply-text">${replyText}</div>
                    </div>
                    ${htmlContent}`;
            }

            // Información de estado (Solo para mis mensajes)
            let statusHtml = '';
            if (msg.sender === currentUser) {
                statusHtml = `
                    <div class="meta-info">
                        <span class="timestamp">${msg.time}</span>
                        <span class="status-icon ${msg.read ? 'read' : ''}" title="${msg.read ? 'Leído' : 'Enviado'}">✓</span>
                    </div>
                `;
            } else {
                statusHtml = `<div class="meta-info"><span class="timestamp">${msg.time}</span></div>`;
            }
            
            messageElement.innerHTML = htmlContent + statusHtml;

            // Evento para seleccionar el mensaje (para responder/marcar)
            messageElement.addEventListener('click', () => {
                if (msg.sender === currentUser) {
                    showActionsModal(msg);
                } else {
                    // Opcional: mostrar modal de solo visualización para mensajes de la pareja
                }
            });

            messageContainer.appendChild(messageElement);
        });
        
        // Scroll al final
        messageContainer.scrollTop = messageContainer.scrollHeight;
    };
    
    // Muestra el modal de acciones del mensaje
    const showActionsModal = (msg) => {
        document.getElementById('selectedMessageText').textContent = msg.text;
        document.getElementById('messageActionsModal').classList.add('active');
        
        // Eliminar listeners previos y añadir nuevos
        const replyBtn = document.getElementById('replyMessageBtn');
        const importantBtn = document.getElementById('markImportantBtn');
        
        replyBtn.onclick = () => {
            setReplyingTo(msg);
            document.getElementById('messageActionsModal').classList.remove('active');
        };

        importantBtn.onclick = () => {
            markMessageImportant(msg);
            document.getElementById('messageActionsModal').classList.remove('active');
        };
    };

    // Marca un mensaje como importante
    const markMessageImportant = (msg) => {
        const messageIndex = currentMessages.findIndex(m => m.id === msg.id);
        if (messageIndex !== -1) {
            currentMessages[messageIndex].important = true;
            chats[currentChat] = currentMessages;
            saveData();
            renderMessages(currentMessages);
            
            // 🟢 Notificar al servidor que el mensaje fue marcado como importante
            socket.emit('markImportant', {
                chatId: currentChat, 
                messageId: msg.id, 
                marker: currentUser
            });
        }
    };
    
    // Configura el estado de respuesta
    const setReplyingTo = (msg) => {
        replyingToId = msg.id;
        replyingToText.textContent = `Respondiendo a: ${msg.text.substring(0, 30)}...`;
        replyingToContainer.classList.add('active');
        messageInput.focus();
    };

    // Cancela el estado de respuesta
    const cancelReplyingTo = () => {
        replyingToId = null;
        replyingToText.textContent = '';
        replyingToContainer.classList.remove('active');
    };
    
    // =======================================================
    // C. MANEJO DE ENVÍO DE MENSAJES
    // =======================================================

    const sendMessage = () => {
        const text = messageInput.value.trim();
        if (text === "") return;

        const newMessage = {
            id: Date.now().toString(), // ID único
            sender: currentUser,
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false, // Por defecto, no leído por el otro
            replyTo: replyingToId,
            important: false,
        };

        // 1. Guardar localmente
        currentMessages.push(newMessage);
        chats[currentChat] = currentMessages;
        saveData();

        // 2. Renderizar
        renderMessages(currentMessages);
        
        // 3. 🟢 Emitir al servidor
        socket.emit('sendMessage', {
            chatKey: currentChat,
            message: newMessage,
            receiver: getPartnerName(),
        });
        
        // 4. Limpiar y resetear
        messageInput.value = '';
        cancelReplyingTo();
        messageInput.style.height = 'auto'; // Resetear altura del textarea
        sendMessageBtn.disabled = true;
    };


    // =======================================================
    // D. EVENT LISTENERS
    // =======================================================

    // Inicialización de la visualización
    partnerNameDisplay.textContent = getPartnerName();
    cancelReplyBtn.addEventListener('click', cancelReplyingTo);
    backToMainBtn.addEventListener('click', () => {
        window.location.href = "menu.html";
    });

    // Envío de mensaje
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Habilitar/Deshabilitar botón de enviar y auto-ajuste de textarea
    messageInput.addEventListener('input', () => {
        // Habilitar/Deshabilitar
        sendMessageBtn.disabled = messageInput.value.trim().length === 0 || partnerStatus === 'paused';
        
        // Auto-ajuste de altura
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    
    // Modales
    document.querySelectorAll('.close-modal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetId = e.target.dataset.modalTarget;
            document.getElementById(targetId).classList.remove('active');
        });
    });


    // =======================================================
    // E. LÓGICA DE SOCKET.IO
    // =======================================================

    // 1. Conexión Establecida
    socket.on('connect', () => {
        console.log("Socket.IO conectado en Chat:", socket.id);
        
        // 🟢 REGISTRO CRÍTICO: Al conectarse, enviamos nuestro nombre de usuario y mood
        // Usamos el mood almacenado, aunque no es la función principal de esta pantalla.
        socket.emit('userConnected', { 
            user: currentUser, 
            mood: sessionStorage.getItem("myMood") || "😴",
        });

        // 🟢 SOLICITAR ESTADO: Pedimos el estado actual de la pareja
        socket.emit('requestPartnerStatus'); 
    });

    // 2. Recepción de MENSAJE NUEVO
    socket.on("newMessage", (data) => {
        // Ignorar mensajes que no son de la pareja
        if (data.sender !== getPartnerName()) return; 
        
        // Añadir el mensaje al chat local
        currentMessages.push({ ...data.message, read: false });
        chats[currentChat] = currentMessages;
        saveData();
        
        // Renderizar y hacer scroll al final
        renderMessages(currentMessages);
        
        // Notificar al servidor que se ha leído el chat al recibir un mensaje
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    });

    // 3. Recepción de ESTADO DE ÁNIMO
    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            // Usamos el status local (online/offline/paused)
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });

    // 4. Lógica de RECEPCIÓN DE ESTADO DE CONEXIÓN Y PAUSA
    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            // Actualizamos la visualización con el nuevo status (online/offline)
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });
    
    socket.on("chatPaused", (data) => {
        if (data.sender === getPartnerName()) {
            // Si la pareja pausó, actualizamos el estado visual
            updatePartnerStatusDisplay(partnerMood, 'paused');
        }
    });
    
    // 5. Recepción de Confirmación de LECTURA
    socket.on("chatRead", (data) => {
        if (data.reader === getPartnerName() && data.chatKey === currentChat) {
            // Marcar todos los mensajes míos en este chat como leídos
            let changed = false;
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
                renderMessages(currentMessages); // Volver a renderizar para ver el check
            }
        }
    });
    
    // 6. Recepción de Mensaje Marcado como Importante
    socket.on("messageMarked", (data) => {
        // Si la pareja marcó un mensaje en este chat como importante
        if (data.sender === getPartnerName() && data.chatId === currentChat) {
            const messageIndex = currentMessages.findIndex(m => m.id === data.messageId);
            if (messageIndex !== -1) {
                currentMessages[messageIndex].important = true;
                chats[currentChat] = currentMessages;
                saveData();
                 renderMessages(currentMessages); // Volver a renderizar
                 // Opcional: Mostrar una alerta o notificación
            }
        }
    });


    // =======================================================
    // F. INICIALIZACIÓN DE chat.html
    // =======================================================

    // 1. Renderiza los mensajes del chat actual
    if (chats[currentChat]) {
        renderMessages(chats[currentChat]);
        // Notificar al servidor que este chat se ha abierto y se ha leído
        // Hacemos esto DESPUÉS de renderizar, solo si estamos seguros que se cargó
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    }
    
    // 2. Inicializar la visualización de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    // 3. Pedir al servidor el estado de ánimo y conexión real de la pareja
    // (Esto ocurre en 'socket.on("connect", ...)')

})(); // Fin del IIFE