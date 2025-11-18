// =======================================================
// A. PARTE DE LOGIN (Se mantiene)
// =======================================================

const PASSWORDS = {
    Leo: "47966714",
    Estefi: "abigail08"
};

const loginBtn = document.getElementById("loginBtn");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        const user = loginUser.value.trim();
        const pass = loginPassword.value.trim();
        loginError.textContent = "";

        if (!user || !pass) {
            loginError.textContent = "Ingrese usuario y contraseña.";
            return;
        }

        if (!PASSWORDS[user] || PASSWORDS[user] !== pass) {
            loginError.textContent = "Usuario o contraseña incorrecta.";
            return;
        }

        sessionStorage.setItem("currentUser", user);
        window.location.href = "index.html";
    });

    [loginUser, loginPassword].forEach(input => {
        input.addEventListener("keypress", e => {
            if (e.key === "Enter") loginBtn.click();
        });
    });
}

// =======================================================
// B. LÓGICA DE CHAT (Implementación completa)
// =======================================================

(function () {
    // Variables globales
    const currentUser = sessionStorage.getItem("currentUser");
    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    let currentChat = null;
    let myMood = sessionStorage.getItem("myMood") || "😴";
    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; 
    let replyingToId = null; 

    // Mapeo de estados y colores (debe coincidir con CSS)
    const MOODS = {
        '😍': { text: 'Enamorado', class: 'mood-enamorado' },
        '😊': { text: 'Feliz', class: 'mood-happy' },
        '😴': { text: 'Cansado/a', class: 'mood-cansado' },
        '😡': { text: 'Enojado/a', class: 'mood-enojado' },
        '😔': { text: 'Triste', class: 'mood-triste' },
        '😫': { text: 'Estresado/a', class: 'mood-estresado' },
        '💬': { text: 'Quiero Hablar', class: 'mood-porhablar' },
    };

    // Funciones de utilidad
    const getPartnerName = () => partnerName;
    const formatDateKey = (date = new Date()) => date.toISOString().split('T')[0];
    const saveData = () => localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));

    // Configuración de Socket.IO (ASUMIENDO QUE ESTÁ EN TU SERVIDOR)
    const socket = (typeof io !== 'undefined') ? io() : { on: () => {}, emit: () => {} };

    // --- Funciones de Renderizado ---

    function renderChatList() {
        const chatListDiv = document.getElementById('chatList');
        if (!chatListDiv) return;
        
        chatListDiv.innerHTML = '<div class="chat-list-header">Chats</div>';
        
        const sortedKeys = Object.keys(chats).sort().reverse();

        sortedKeys.forEach(key => {
            const chat = chats[key];
            if (!chat || chat.length === 0) return;

            const lastMessage = chat[chat.length - 1];
            const unreadCount = chat.filter(msg => msg.sender !== currentUser && !msg.read).length;

            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${unreadCount > 0 ? 'unread' : ''}`;
            chatItem.dataset.chatKey = key;
            chatItem.onclick = () => openChat(key);

            let lastText = lastMessage.text;
            if (lastMessage.replyToText) {
                lastText = `↩️ Respondió: ${lastMessage.text}`;
            } else if (lastMessage.important) {
                lastText = `🌟 Importante: ${lastMessage.text}`;
            } else if (lastMessage.sender === currentUser) {
                lastText = `Tú: ${lastText}`;
            }

            const date = new Date(lastMessage.timestamp);
            const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

            chatItem.innerHTML = `
                <div class="avatar">${key.substring(8, 10)}/${key.substring(5, 7)}</div>
                <div class="meta">
                    <span class="chat-name">${key}</span>
                    <span class="chat-last">${lastText}</span>
                </div>
                <span class="chat-date">${dateStr}</span>
                ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
            `;
            chatListDiv.appendChild(chatItem);
        });
    }

    function renderMessages(messages) {
        const container = document.getElementById('messageContainer');
        if (!container) return;

        container.innerHTML = '';

        messages.forEach(msg => {
            const isMe = msg.sender === currentUser;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isMe ? 'me' : 'them'} ${msg.important ? 'important' : ''} ${msg.replyToText ? 'reply' : ''}`;
            messageDiv.dataset.messageId = msg.id;
            messageDiv.onclick = () => openMessageActionsModal(msg);
            
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
        
        const emojiCircle = document.getElementById('emojiCircle');
        const statusHeader = document.getElementById('partnerStatusHeader');
        const chatHeaderStatus = document.getElementById('partnerStatus');
        
        if (emojiCircle) {
            const moodData = MOODS[moodEmoji] || { text: 'Ausente', class: 'mood-default' };
            emojiCircle.textContent = moodEmoji;
            
            // Remover clases de mood anteriores
            Object.values(MOODS).forEach(m => emojiCircle.classList.remove(m.class));
            emojiCircle.classList.remove('mood-default');

            // Añadir clase de mood actual
            emojiCircle.classList.add(moodData.class);

            // Manejo del estado de conexión
            emojiCircle.classList.remove('status-online', 'status-offline', 'status-paused');
            emojiCircle.classList.add(`status-${status}`);
        }

        // Actualizar texto de estado
        if (statusHeader) {
            let statusText = status === 'online' ? 'Disponible' : (status === 'paused' ? 'Pausado' : 'Ausente');
            const moodText = (MOODS[moodEmoji] && moodEmoji !== '?') ? `(${MOODS[moodEmoji].text})` : '';
            statusHeader.textContent = `${statusText} ${moodText}`;
        }

        // Actualizar el estado en el header del chat
        if (chatHeaderStatus) {
            chatHeaderStatus.textContent = status === 'online' ? 'En línea' : (status === 'paused' ? 'Pausado' : 'Última vez hace mucho...');
        }

        // Habilitar/deshabilitar input de chat
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        const canChat = myMood !== '😴' && status !== 'paused';

        if (input) {
            input.disabled = !canChat;
            input.placeholder = canChat 
                ? 'Escribe un mensaje...' 
                : (myMood === '😴' ? 'Selecciona tu estado para chatear.' : 'El chat está pausado o tu pareja no está.');
        }
        if (sendBtn) {
            sendBtn.disabled = !canChat;
        }
    }

    function renderMoods() {
        const moodList = document.getElementById('moodList');
        if (!moodList) return;

        moodList.innerHTML = '';
        Object.keys(MOODS).forEach(emoji => {
            const button = document.createElement('button');
            button.className = `mood-btn ${emoji === myMood ? 'selected' : ''}`;
            button.textContent = emoji;
            button.dataset.mood = emoji;
            button.onclick = () => selectMood(emoji);
            moodList.appendChild(button);
        });
    }

    function updateMyMoodButton(emoji) {
        myMood = emoji;
        sessionStorage.setItem("myMood", emoji);
        const myMoodBtn = document.getElementById('openMoodModal');
        if (myMoodBtn) {
            myMoodBtn.textContent = emoji;
        }
    }
    
    // --- Lógica de Modales y Acciones ---

    function openModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    }

    function closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }

    function openMessageActionsModal(message) {
        if (message.sender !== currentUser) return; // Solo puedo hacer acciones en mis mensajes
        
        const modal = document.getElementById('messageActionsModal');
        const selectedMessageText = document.getElementById('selectedMessageText');
        const markImportantBtn = document.getElementById('markImportantBtn');
        const replyMessageBtn = document.getElementById('replyMessageBtn');

        if (!modal || !selectedMessageText || !markImportantBtn || !replyMessageBtn) return;
        
        // Guardar ID del mensaje
        modal.dataset.messageId = message.id;

        // Mostrar texto
        selectedMessageText.textContent = message.text;

        // Configurar botón de Importante
        if (message.important) {
            markImportantBtn.textContent = '✅ Marcado como importante';
            markImportantBtn.disabled = true;
        } else {
            markImportantBtn.textContent = '🌟 Marcar como importante';
            markImportantBtn.disabled = false;
        }

        // Eventos
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

    function selectMood(emoji) {
        myMood = emoji;
        updateMyMoodButton(emoji);
        renderMoods(); // Actualiza la selección visual del modal
        closeModal('moodsContainer');
        
        // Notificar a la pareja
        socket.emit('moodChanged', { sender: currentUser, mood: emoji });
        
        // Actualizar display de mi pareja (para habilitar/deshabilitar input)
        updatePartnerStatusDisplay(partnerMood, partnerStatus); 
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
        
        // Si es una respuesta, adjuntar el texto original para mostrar en la burbuja
        if (replyingToId) {
            const originalMessage = chats[currentChat].find(m => m.id === replyingToId);
            if (originalMessage) {
                newMessage.replyToText = originalMessage.text;
            }
        }

        chats[currentChat].push(newMessage);
        saveData();
        renderMessages(chats[currentChat]);
        
        // Enviar por socket
        socket.emit('sendMessage', { 
            chatKey: currentChat, 
            message: newMessage,
            recipient: partnerName // Para identificar a quién va dirigido
        });

        // Limpiar
        input.value = '';
        cancelReplyContext();
    }
    
    // --- Lógica de Pausa ---
    function renderPauseButtons() {
        const buttonsContainer = document.getElementById('pauseTimeButtons');
        if (!buttonsContainer) return;

        buttonsContainer.innerHTML = '';
        const pauseTimes = [5, 15, 30, 60]; // Minutos

        pauseTimes.forEach(time => {
            const button = document.createElement('button');
            button.className = 'mood-btn';
            button.textContent = `${time} Min`;
            button.onclick = () => pauseChat(time);
            buttonsContainer.appendChild(button);
        });
    }
    
    function pauseChat(minutes) {
        // Lógica de pausa: Implementación simplificada (solo notifica)
        const now = Date.now();
        const lastPause = parseInt(sessionStorage.getItem('lastPauseTime') || '0', 10);
        
        if (now - lastPause < 3600000) { // 3600000ms = 1 hora
            alert('Solo puedes pausar el chat una vez por hora.');
            closeModal('pauseTimeModal');
            return;
        }

        sessionStorage.setItem('lastPauseTime', now);
        
        // Notificar a la pareja sobre la pausa
        socket.emit('chatPaused', { sender: currentUser, duration: minutes });
        
        // Actualizar el estado local (no es persistente, asumo que el servidor lo manejará)
        updatePartnerStatusDisplay(partnerMood, 'paused');
        
        closeModal('pauseTimeModal');
    }

    // --- Funciones de Cambio de Pantalla ---

    function openChat(chatKey) {
        currentChat = chatKey;
        
        // 🔴 CRÍTICO: Oculta la pantalla principal
        document.getElementById('mainScreen').classList.remove('active');
        
        // 🔴 CRÍTICO: Muestra la pantalla de chat
        document.getElementById('chatScreen').classList.add('active');
        
        document.getElementById('partnerName').textContent = getPartnerName();
        updatePartnerStatusDisplay(partnerMood, partnerStatus); 

        renderMessages(chats[currentChat]);

        // Notificar que se ha leído el chat
        socket.emit('readChat', { chatKey, reader: currentUser });

        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        if (input) {
            input.disabled = false;
            sendBtn.disabled = false;
            setTimeout(() => input.focus(), 100); 
        }
    }

    function closeChat() {
        currentChat = null;
        
        // 🔴 CRÍTICO: Oculta la pantalla de chat
        document.getElementById('chatScreen').classList.remove('active');
        
        // 🔴 CRÍTICO: Muestra la pantalla principal
        document.getElementById('mainScreen').classList.add('active');
        
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        if (input) {
            input.disabled = true;
            sendBtn.disabled = true;
        }
        renderChatList(); 
    }


    // --- Configuración de Eventos ---

    if (window.location.pathname.endsWith('index.html')) {
        document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        document.getElementById('openMoodModal')?.addEventListener('click', () => openModal('moodsContainer'));
        document.getElementById('openPauseModal')?.addEventListener('click', () => openModal('pauseTimeModal'));
        document.getElementById('backToMain')?.addEventListener('click', closeChat);
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
    }

    // --- Lógica de Socket.IO ---

    // Lógica de RECEPCIÓN DE MENSAJES
    socket.on("receiveMessage", (data) => { 
        if (data.recipient === currentUser) {
            const { chatKey, message } = data;

            if (!chats[chatKey]) {
                chats[chatKey] = [];
            }
            chats[chatKey].push(message);
            saveData();

            // Si el chat está abierto, renderiza el nuevo mensaje y notifica que se ha leído
            if (currentChat === chatKey) {
                renderMessages(chats[currentChat]);
                socket.emit('readChat', { chatKey, reader: currentUser });
            }
            renderChatList(); // Siempre actualiza la lista para el conteo de no leídos
        }
    });

    // Lógica de CONFIRMACIÓN DE LECTURA
    socket.on("chatRead", (data) => {
        if (data.reader === currentUser) return; // Solo nos interesa si la pareja lee

        const { chatKey } = data;
        const chat = chats[chatKey];

        if (chat) {
            chat.forEach(msg => {
                // Marca como leído todo lo que el otro usuario haya enviado
                if (msg.sender !== data.reader) { 
                     msg.read = true;
                }
            });
            saveData();
            renderMessages(chat); 
        }
    });

    // Lógica de RECEPCIÓN DE ESTADO DE ÁNIMO
    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });

    // Lógica de RECEPCIÓN DE ESTADO DE CONEXIÓN
    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });

    // --- Lógica de RECEPCIÓN DE PAUSA ---
    socket.on("chatPaused", (data) => {
        if (data.sender === getPartnerName()) {
            // Nota: Esto es solo un ejemplo. Idealmente el servidor manejaría el tiempo.
            // Aquí, simplemente actualizamos el estado visual de la pareja a "paused"
            updatePartnerStatusDisplay(partnerMood, 'paused');
            alert(`El chat fue pausado por ${getPartnerName()} por ${data.duration} minutos.`);
        }
    });


// =======================================================
// C. INICIALIZACIÓN 
// =======================================================

    // Si estamos en la interfaz principal (index.html), ejecutamos el setup
    if (window.location.pathname.endsWith('index.html')) {
        
        // 1. Asegurarse de que el chat de hoy exista 
        const todayKey = formatDateKey();
        if (!chats[todayKey]) {
            chats[todayKey] = [];
            saveData();
        }
        
        // 2. Renderizar la lista de chats y los modales
        renderChatList(); 
        renderMoods();
        renderPauseButtons();
        updateMyMoodButton(myMood);
        
        // 3. Inicializar el estado de la pareja
        // Al cargar, asumimos offline hasta que el servidor confirme el estado real.
        updatePartnerStatusDisplay(partnerMood, 'offline'); 
        
        // 4. Pedir al servidor el estado de ánimo y conexión real de la pareja
        socket.emit('requestPartnerStatus'); 
    }
    
})();