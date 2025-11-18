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
    const saveData = () => localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    
    // Configuración de Socket.IO
    const socket = (typeof io !== 'undefined') ? io() : { on: () => {}, emit: () => {} };
    
    // Si no hay chatKey en la URL, redirige al menú (ERROR DE NAVEGACIÓN)
    if (!currentChat) {
        window.location.href = "menu.html";
        return; 
    }

    // --- Funciones de Renderizado ---

    function renderMessages(messages) {
        const container = document.getElementById('messageContainer');
        if (!container) return;

        container.innerHTML = '';

        messages.forEach(msg => {
            const isMe = msg.sender === currentUser;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isMe ? 'me' : 'them'} ${msg.important ? 'important' : ''} ${msg.replyToText ? 'reply' : ''}`;
            messageDiv.dataset.messageId = msg.id;
            
            // Solo se pueden hacer acciones en mis propios mensajes
            if (isMe) {
                 messageDiv.onclick = () => openMessageActionsModal(msg);
            }
            
            let replyHtml = '';
            if (msg.replyToText) {
                replyHtml = `
                    <div class="reply-box">
                        ${msg.replyToText}
                    </div>
                `;
            }
            
            let statusIcon = '';
            if (isMe) {
                statusIcon = msg.read 
                    ? '<span class="status-icon read">✓✓</span>'
                    : '<span class="status-icon">✓</span>';
            }

            messageDiv.innerHTML = `
                ${replyHtml}
                <div class="message-content">${msg.text}</div>
                <div class="meta-info">
                    ${new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    ${statusIcon}
                </div>
            `;
            container.appendChild(messageDiv);
        });
        container.scrollTop = container.scrollHeight;
    }

    function updatePartnerStatusDisplay(moodEmoji, status) {
        partnerMood = moodEmoji;
        partnerStatus = status;
        
        const chatHeaderStatus = document.getElementById('partnerStatus');
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        
        // Actualizar el estado en el header del chat
        if (chatHeaderStatus) {
            chatHeaderStatus.textContent = status === 'online' ? 'En línea' : (status === 'paused' ? 'Pausado' : 'Última vez hace mucho...');
        }

        // Habilitar/deshabilitar input de chat
        const myMood = sessionStorage.getItem("myMood") || "😴";
        const canChat = myMood !== '😴' && status !== 'paused';

        if (input) {
            input.disabled = !canChat;
            input.placeholder = canChat 
                ? 'Escribe un mensaje...' 
                : (myMood === '😴' ? 'Selecciona tu estado para chatear.' : 'El chat está pausado o tu pareja no está.');
        }
        if (sendBtn) {
            sendBtn.disabled = !canChat || input.value.trim() === ''; // También depende de si hay texto
        }
    }
    
    // --- Lógica de Modales y Acciones de Mensaje ---

    function openModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    }

    function closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }

    function openMessageActionsModal(message) {
        if (message.sender !== currentUser) return; 
        
        const modal = document.getElementById('messageActionsModal');
        const selectedMessageText = document.getElementById('selectedMessageText');
        const markImportantBtn = document.getElementById('markImportantBtn');
        const replyMessageBtn = document.getElementById('replyMessageBtn');

        if (!modal || !selectedMessageText || !markImportantBtn || !replyMessageBtn) return;
        
        modal.dataset.messageId = message.id;
        selectedMessageText.textContent = message.text;

        if (message.important) {
            markImportantBtn.textContent = '✅ Marcado como importante';
            markImportantBtn.disabled = true;
        } else {
            markImportantBtn.textContent = '🌟 Marcar como importante';
            markImportantBtn.disabled = false;
        }

        markImportantBtn.onclick = () => markMessageImportant(message.id);
        replyMessageBtn.onclick = () => {
            setReplyContext(message.text, message.id);
            closeModal('messageActionsModal');
        };

        openModal('messageActionsModal');
    }
    
    function markMessageImportant(messageId) {
        const chat = chats[currentChat];
        if (!chat) return;

        const message = chat.find(m => m.id === messageId);
        if (message && message.sender === currentUser) {
            message.important = true;
            saveData();
            renderMessages(chat);
            closeModal('messageActionsModal');
            // Nota: Podrías emitir un socket aquí si quieres que la pareja se entere
        }
    }
    
    function setReplyContext(text, id) {
        replyingToId = id;
        const replyingToContainer = document.getElementById('replyingToContainer');
        const replyingToText = document.getElementById('replyingToText');
        
        if (replyingToContainer && replyingToText) {
            replyingToText.textContent = `Respondiendo a: "${text}"`;
            replyingToContainer.style.display = 'flex';
        }
    }

    function cancelReplyContext() {
        replyingToId = null;
        const replyingToContainer = document.getElementById('replyingToContainer');
        if (replyingToContainer) {
            replyingToContainer.style.display = 'none';
        }
    }

    // --- Lógica de Enviar Mensaje ---
    function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text || !currentChat) return;

        const newMessage = {
            id: Date.now().toString(),
            sender: currentUser,
            text: text,
            timestamp: new Date().toISOString(),
            read: false,
            important: false,
            replyToId: replyingToId,
            replyToText: null 
        };
        
        if (replyingToId) {
            const originalMessage = chats[currentChat].find(m => m.id === replyingToId);
            if (originalMessage) {
                newMessage.replyToText = originalMessage.text;
            }
        }

        if (!chats[currentChat]) {
            chats[currentChat] = [];
        }
        chats[currentChat].push(newMessage);
        saveData();
        renderMessages(chats[currentChat]);
        
        // Enviar por socket
        socket.emit('sendMessage', { 
            chatKey: currentChat, 
            message: newMessage,
            recipient: partnerName 
        });

        // Limpiar
        input.value = '';
        cancelReplyContext();
        updatePartnerStatusDisplay(partnerMood, partnerStatus); // Para actualizar el estado del botón Enviar
    }
    
    // --- Configuración de Eventos ---

    document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    document.getElementById('messageInput')?.addEventListener('input', () => {
        // Asegurar que el botón de enviar se habilite/deshabilite correctamente
        updatePartnerStatusDisplay(partnerMood, partnerStatus); 
    });
    
    document.getElementById('backToMain')?.addEventListener('click', () => {
        // 🔴 NUEVA LÓGICA: Redirige de vuelta al menú
        window.location.href = 'menu.html';
    });
    
    document.getElementById('cancelReplyBtn')?.addEventListener('click', cancelReplyContext);

    // Eventos para cerrar modales (delegación)
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                closeModal(modal.id);
            }
        });
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.modalTarget || e.currentTarget.closest('.modal-backdrop')?.id;
            if (targetId) {
                closeModal(targetId);
            }
        });
    });

    // --- Lógica de Socket.IO ---

    socket.on("receiveMessage", (data) => { 
        if (data.recipient === currentUser && data.chatKey === currentChat) {
            const { chatKey, message } = data;

            if (!chats[chatKey]) chats[chatKey] = [];
            chats[chatKey].push(message);
            saveData();

            // Si el mensaje es para este chat, lo renderizamos y lo marcamos como leído
            renderMessages(chats[currentChat]);
            socket.emit('readChat', { chatKey, reader: currentUser });
        }
    });

    socket.on("chatRead", (data) => {
        if (data.reader === currentUser) return; 

        const { chatKey } = data;
        
        if (chatKey === currentChat && chats[chatKey]) {
            chats[chatKey].forEach(msg => {
                if (msg.sender !== data.reader) { 
                     msg.read = true;
                }
            });
            saveData();
            renderMessages(chats[currentChat]); 
        }
    });

    // Lógica de RECEPCIÓN DE ESTADO DE ÁNIMO
    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });

    // Lógica de RECEPCIÓN DE ESTADO DE CONEXIÓN Y PAUSA
    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });
    
    socket.on("chatPaused", (data) => {
        if (data.sender === getPartnerName()) {
            updatePartnerStatusDisplay(partnerMood, 'paused');
        }
    });


    // =======================================================
    // INICIALIZACIÓN DE chat.html
    // =======================================================

    // 1. Renderiza los mensajes del chat actual
    if (chats[currentChat]) {
        renderMessages(chats[currentChat]);
        // Notificar al servidor que este chat se ha abierto y se ha leído
        socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
    }
    
    // 2. Inicializar la visualización de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    // 3. Pedir al servidor el estado de ánimo y conexión real de la pareja
    socket.emit('requestPartnerStatus'); 
    
    // 4. Establecer el nombre de la pareja en el header
    document.getElementById('partnerName').textContent = getPartnerName();
    
})();