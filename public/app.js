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
    // ----------------------------------------------------
    // CONSTANTES Y ESTADO GLOBAL
    // ----------------------------------------------------
    const currentUser = sessionStorage.getItem("currentUser") || 'Anonimo';
    let chats = JSON.parse(localStorage.getItem("chats")) || {};
    let currentChat = null;
    let replyToMessageId = null; 

    // Asumimos que la conexión al servidor de sockets está disponible (o un mock si no lo está)
    const socket = (typeof io !== 'undefined') ? io() : { on: () => {}, emit: () => {} }; 

    let myMood = sessionStorage.getItem("myMood") || '😴'; 
    let partnerMood = sessionStorage.getItem("partnerMood") || '?'; 
    let partnerStatus = 'offline'; 

    const moodMap = {
        '❤️': { text: 'Enamorado/a', class: 'enamorado' },
        '😊': { text: 'Feliz', class: 'happy' },
        '😴': { text: 'Cansado/a', class: 'cansado' },
        '😔': { text: 'Triste', class: 'sad' },
        '😠': { text: 'Enojado/a', class: 'angry' },
        '😟': { text: 'Ansioso/a', class: 'ansioso' },
        '💡': { text: 'Inspirado/a', class: 'inspirado' },
        '💼': { text: 'Ocupado/a', class: 'ocupado' },
        '?': { text: 'Ausente', class: 'default' }
    };
    
    const PAUSE_TIMES = [
        { label: '30 min', duration: 30 * 60 * 1000 },
        { label: '1 hora', duration: 60 * 60 * 1000 },
        { label: '2 horas', duration: 2 * 60 * 60 * 1000 },
        { label: '4 horas', duration: 4 * 60 * 60 * 1000 },
    ];

    // ----------------------------------------------------
    // FUNCIONES AUXILIARES
    // ----------------------------------------------------

    function saveData() {
        localStorage.setItem("chats", JSON.stringify(chats));
    }
    
    function generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function formatDateKey(date = new Date()) {
        return date.toISOString().split('T')[0];
    }
    
    function getPartnerName() {
        return currentUser === 'Leo' ? 'Estefi' : 'Leo';
    }

    function toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.toggle('active', show);
        }
    }

    // Actualiza el estado GRANDE en MainScreen y el PEQUEÑO en ChatHeader
    function updatePartnerStatusDisplay(moodEmoji, statusText) {
        const emojiCircle = document.getElementById('emojiCircle'); 
        const partnerStatusDisplay = document.getElementById('partnerStatus'); 
        const partnerMoodEmojiDisplay = document.getElementById('partnerMoodEmoji'); 
        const partnerMoodTextDisplay = document.getElementById('partnerMoodText'); 
        
        partnerMood = moodEmoji;
        partnerStatus = statusText;

        // a) Actualizar MainScreen (Círculo Grande de Pareja)
        if (emojiCircle) {
            emojiCircle.textContent = moodEmoji;
            const moodData = moodMap[moodEmoji] || moodMap['?'];
            
            emojiCircle.className = 'emoji-circle';
            Object.values(moodMap).forEach(m => emojiCircle.classList.remove(`mood-${m.class}`));
            emojiCircle.classList.add(`mood-${moodData.class}`);
        }

        // b) Actualizar Chat Header (si el chat está abierto)
        if (partnerStatusDisplay) {
            partnerStatusDisplay.textContent = statusText.toUpperCase();
            partnerStatusDisplay.style.color = statusText === 'online' ? 'var(--primary)' : 'var(--muted)';
        }
        if (partnerMoodEmojiDisplay) {
            const moodData = moodMap[moodEmoji] || moodMap['?'];
            partnerMoodEmojiDisplay.textContent = moodEmoji; 
            if (partnerMoodTextDisplay) {
                 partnerMoodTextDisplay.textContent = `(${moodData.text})`;
            }
        }
    }

    function updateMyMoodButton(mood) {
        const btn = document.getElementById('openMoodModal');
        if (btn) {
            btn.textContent = mood;
        }
    }
    
    function renderMoods() {
        const moodListDiv = document.getElementById('moodList');
        if (!moodListDiv) return;

        moodListDiv.innerHTML = '';
        Object.keys(moodMap).filter(key => key !== '?').forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'mood-btn';
            btn.textContent = emoji;
            btn.setAttribute('data-mood', emoji);
            btn.onclick = () => selectMood(emoji);
            moodListDiv.appendChild(btn);
        });

        document.getElementById('openMoodModal')?.addEventListener('click', () => toggleModal('moodsContainer', true));

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.getAttribute('data-modal-target');
                if (modalId) {
                    toggleModal(modalId, false);
                } else {
                    e.currentTarget.closest('.modal-backdrop').classList.remove('active');
                }
            });
        });
    }

    function selectMood(emoji) {
        myMood = emoji;
        sessionStorage.setItem("myMood", myMood);
        updateMyMoodButton(myMood);
        toggleModal('moodsContainer', false);
        socket.emit('moodChange', { sender: currentUser, mood: myMood });
    }

    // ----------------------------------------------------
    // RENDERING DE PANTALLAS
    // ----------------------------------------------------

    function renderChatList() {
        const chatListDiv = document.getElementById('chatList');
        if (!chatListDiv) return;

        chatListDiv.innerHTML = ''; 
        const chatKeys = Object.keys(chats).sort((a, b) => b.localeCompare(a));

        chatKeys.forEach(key => {
            const chat = chats[key];
            const lastMsg = chat[chat.length - 1];
            const dateStr = key;

            const item = document.createElement('button');
            item.className = 'chat-item';
            item.setAttribute('data-chatkey', key);
            item.onclick = () => openChat(key);

            item.innerHTML = `
                <div class="meta">
                    <div class="chat-name">Chat ${dateStr}</div>
                    <div class="chat-last">${lastMsg ? (lastMsg.sender === currentUser ? 'Tú' : getPartnerName()) + ': ' + lastMsg.text : 'Comenzar chat...'}</div>
                </div>
            `;
            chatListDiv.appendChild(item);
        });
    }

    // Lógica principal de renderizado de mensajes
    function renderMessages(messageList) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';
        
        // 1. Obtener ID del ÚLTIMO mensaje enviado por el usuario actual
        let lastSentMessageId = null;
        let lastSentMessageIndex = -1;

        const allSentMessages = messageList.filter(msg => msg.sender === currentUser);
        if (allSentMessages.length > 0) {
             // Encuentra el ID y el índice del último mensaje enviado por el usuario actual
             for (let i = messageList.length - 1; i >= 0; i--) {
                if (messageList[i].sender === currentUser) {
                    lastSentMessageId = messageList[i].id;
                    lastSentMessageIndex = i;
                    break;
                }
             }
        }

        // 2. Iterar y renderizar
        messageList.forEach((msg, index) => {
            // A. Crear la burbuja de mensaje
            const div = document.createElement('div');
            div.classList.add('message');
            div.classList.add(msg.sender === currentUser ? 'sent' : 'received');
            div.classList.toggle('important', msg.important);

            div.setAttribute('data-id', msg.id);
            div.setAttribute('data-sender', msg.sender);
            div.textContent = msg.text;

            // Añadir el timestamp
            const ts = document.createElement('span');
            ts.classList.add('ts');
            const date = new Date(msg.timestamp);
            ts.textContent = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            div.appendChild(ts);

            // Evento para abrir el modal de acciones
            div.addEventListener('click', () => handleMessageAction(msg.id, msg.text, msg.sender === currentUser));
            
            messagesContainer.appendChild(div);

            // B. LÓGICA DE "VISTO" (Elemento Bloque Separado)
            // Solo si es el último mensaje enviado por mí Y está marcado como leído
            if (msg.sender === currentUser && msg.id === lastSentMessageId && msg.read) {
                
                // CRÍTICO: Comprobar si la pareja ya ha respondido *después* de este mensaje.
                let partnerRepliedAfter = false;
                for (let i = index + 1; i < messageList.length; i++) {
                    if (messageList[i].sender !== currentUser) {
                        partnerRepliedAfter = true;
                        break;
                    }
                }
                
                // Si NO ha respondido, mostramos el "Visto".
                if (!partnerRepliedAfter) {
                    const readStatus = document.createElement('div');
                    readStatus.className = 'read-status'; 
                    readStatus.textContent = 'Visto';
                    
                    messagesContainer.appendChild(readStatus); 
                }
            }
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function openChat(chatKey) {
        currentChat = chatKey;
        document.getElementById('mainScreen').classList.remove('active');
        document.getElementById('chatScreen').classList.add('active');
        
        document.getElementById('partnerName').textContent = getPartnerName();
        updatePartnerStatusDisplay(partnerMood, partnerStatus); 

        renderMessages(chats[currentChat]);

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
        document.getElementById('chatScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        if (input) {
            input.disabled = true;
            sendBtn.disabled = true;
        }
        renderChatList(); 
    }

    // ----------------------------------------------------
    // MANEJADORES DE EVENTOS
    // ----------------------------------------------------

    function handleMessageAction(messageId, messageText, isSent) {
        const modal = document.getElementById('messageActionsModal');
        const selectedMessageText = document.getElementById('selectedMessageText');
        const markImportantBtn = document.getElementById('markImportantBtn');
        const replyMessageBtn = document.getElementById('replyMessageBtn');

        selectedMessageText.textContent = messageText;

        markImportantBtn.disabled = true;
        markImportantBtn.onclick = null;
        replyMessageBtn.onclick = null;

        // CRÍTICO: Solo se pueden marcar como importantes los mensajes propios (isSent=true)
        if (isSent) {
            markImportantBtn.disabled = false;
            const chat = chats[currentChat];
            const message = chat.find(msg => msg.id === messageId);
            // Actualiza el texto del botón basado en el estado actual
            markImportantBtn.textContent = message.important ? '⭐ Quitar importante' : '🌟 Marcar como importante';

            markImportantBtn.onclick = () => {
                markMessageImportant(messageId);
                toggleModal('messageActionsModal', false);
            };
        } else {
             markImportantBtn.textContent = '🌟 (Solo mensajes propios)';
        }

        // Lógica de respuesta 
        replyMessageBtn.onclick = () => {
            replyToMessageId = messageId;
            // Aquí puedes agregar lógica visual para mostrar que estás respondiendo
            toggleModal('messageActionsModal', false);
            document.getElementById('messageInput').focus();
        };


        toggleModal('messageActionsModal', true);
    }

    function markMessageImportant(messageId) {
        const chat = chats[currentChat];
        const message = chat.find(msg => msg.id === messageId);
        if (message && message.sender === currentUser) { 
            message.important = !message.important;
            saveData();
            renderMessages(chat);
            socket.emit('messageUpdate', { chatKey: currentChat, messageId: message.id, important: message.important });
        }
    }
    
    function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (text === '' || !currentChat) return;

        const newMessage = {
            id: generateMessageId(),
            sender: currentUser,
            text: text,
            timestamp: Date.now(),
            read: false,
            important: false,
            replyTo: replyToMessageId 
        };
        
        chats[currentChat].push(newMessage);
        saveData();
        renderMessages(chats[currentChat]);

        socket.emit('sendMessage', { chatKey: currentChat, message: newMessage, receiver: getPartnerName() });

        input.value = ''; 
        replyToMessageId = null; 
        
        input.focus(); 
    }

    function handlePause(duration) {
        console.log(`Pausa solicitada por ${duration / 60000} minutos.`);
        toggleModal('pauseTimeModal', false);
        // Implementar lógica de deshabilitar input, guardar estado y emitir a socket.
    }
    
    function renderPauseButtons() {
        const container = document.getElementById('pauseTimeButtons');
        if (!container) return;

        container.innerHTML = '';
        PAUSE_TIMES.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'btn mood-btn'; // Usamos la clase mood-btn para estilo de grid
            btn.textContent = item.label;
            btn.onclick = () => handlePause(item.duration);
            container.appendChild(btn);
        });

        document.getElementById('pauseChatBtn')?.addEventListener('click', () => toggleModal('pauseTimeModal', true));
    }


    // ----------------------------------------------------
    // ASIGNACIÓN DE EVENTOS Y SOCKETS
    // ----------------------------------------------------

    document.getElementById('backToMain')?.addEventListener('click', closeChat);
    document.getElementById('addChatBtn')?.addEventListener('click', () => openChat(formatDateKey()));
    document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Lógica de RECEPCIÓN DE MENSAJES
    socket.on('receiveMessage', (data) => {
        if (data.receiver === currentUser) {
            const chat = chats[data.chatKey];
            if (chat) {
                chat.push(data.message);
                saveData();
                
                if (data.chatKey === currentChat) {
                    renderMessages(chat);
                    socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
                } else {
                    renderChatList(); 
                }
            }
        }
    });
    
    // Lógica de CONFIRMACIÓN DE LECTURA
    socket.on('messageRead', (data) => {
        if (data.reader !== currentUser && data.chatKey === currentChat) {
            const chat = chats[data.chatKey];
            chat.forEach(msg => {
                // Solo marcar como leído si yo lo envié
                if (msg.sender === currentUser) {
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

// =======================================================
// C. INICIALIZACIÓN 
// =======================================================

    // Si estamos en la interfaz principal (index.html), ejecutamos el setup
    if (window.location.pathname.endsWith('index.html')) {
        
        const todayKey = formatDateKey();
        if (!chats[todayKey]) {
            chats[todayKey] = [];
            saveData();
        }
        
        renderChatList(); 
        renderMoods();
        renderPauseButtons();
        updateMyMoodButton(myMood);
        
        updatePartnerStatusDisplay(partnerMood, 'offline'); 
        
        socket.emit('requestPartnerStatus'); 
    }
    
})();