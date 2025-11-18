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
    let replyToMessageId = null; // Para la funcionalidad de respuesta

    // Asumimos que la conexión al servidor de sockets está disponible
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
    
    // Función para renderizar los botones del modal de estados de ánimo
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

        // Evento para abrir el modal de estados de ánimo
        document.getElementById('openMoodModal')?.addEventListener('click', () => toggleModal('moodsContainer', true));

        // Eventos para cerrar modales
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.getAttribute('data-modal-target');
                if (modalId) {
                    toggleModal(modalId, false);
                } else {
                    // Cierra el modal padre si no tiene target específico (fallback)
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
        // Informar al servidor sobre el cambio de estado de ánimo
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
        const allSentMessages = messageList.filter(msg => msg.sender === currentUser);
        if (allSentMessages.length > 0) {
            lastSentMessageId = allSentMessages[allSentMessages.length - 1].id;
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
                    
                    // Lo añadimos DESPUÉS de la burbuja del mensaje, como bloque separado
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
        
        // Actualizar header del chat (nombre, estado y ánimo de la pareja)
        document.getElementById('partnerName').textContent = getPartnerName();
        updatePartnerStatusDisplay(partnerMood, partnerStatus); 

        renderMessages(chats[currentChat]);

        // Emitir evento al servidor para marcar los mensajes como leídos
        socket.emit('readChat', { chatKey, reader: currentUser });

        // Habilitar y enfocar el input para simular la elevación del teclado
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
        
        // Deshabilitar input al salir del chat
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        if (input) {
            input.disabled = true;
            sendBtn.disabled = true;
        }
        renderChatList(); // Refrescar la lista de chats al volver
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

        // Limpiar handlers y resetear estados
        markImportantBtn.disabled = true;
        markImportantBtn.onclick = null;
        replyMessageBtn.onclick = null; // Asumiendo que quieres que funcione para propios y ajenos

        // Si el mensaje es SENT (enviado por mí), habilito el botón importante.
        if (isSent) {
            markImportantBtn.disabled = false;
            markImportantBtn.onclick = () => {
                markMessageImportant(messageId);
                toggleModal('messageActionsModal', false);
            };
        }

        // Lógica de respuesta (funciona para ambos)
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
        // CRÍTICO: Solo se marcan los mensajes propios
        if (message && message.sender === currentUser) { 
            message.important = !message.important;
            saveData();
            renderMessages(chat);
            socket.emit('messageUpdate', { chatKey: currentChat, messageId: message.id, important: message.important });
        }
    }
    
    // Función para manejar el envío de mensajes
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
            replyTo: replyToMessageId // Incluye el ID del mensaje al que se responde
        };
        
        chats[currentChat].push(newMessage);
        saveData();
        renderMessages(chats[currentChat]);

        socket.emit('sendMessage', { chatKey: currentChat, message: newMessage, receiver: getPartnerName() });

        input.value = ''; // Limpiar input
        replyToMessageId = null; // Limpiar estado de respuesta
        
        // Enfocar el input nuevamente después de enviar
        input.focus(); 
    }

    // Función para manejar la pausa del chat (placeholder)
    function handlePause(duration) {
        // Lógica real de pausa:
        // 1. Deshabilitar input
        // 2. Enviar evento al servidor
        // 3. Establecer un temporizador local

        console.log(`Pausa solicitada por ${duration / 60000} minutos.`);
        toggleModal('pauseTimeModal', false);
        // Aquí iría la lógica para deshabilitar el chat e informar al servidor.
    }
    
    function renderPauseButtons() {
        const container = document.getElementById('pauseTimeButtons');
        if (!container) return;

        container.innerHTML = '';
        PAUSE_TIMES.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'btn primary small';
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
                    // Emitir que se leyó si está en el chat
                    socket.emit('readChat', { chatKey: currentChat, reader: currentUser });
                } else {
                    renderChatList(); // Actualizar el listado si el chat no está abierto
                }
            }
        }
    });
    
    // Lógica de CONFIRMACIÓN DE LECTURA
    socket.on('messageRead', (data) => {
        if (data.reader !== currentUser && data.chatKey === currentChat) {
            const chat = chats[data.chatKey];
            // Marcar todos los mensajes como leídos
            chat.forEach(msg => msg.read = true);
            saveData();
            renderMessages(chat); // Refrescar para que aparezca el "Visto"
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
        
        // 1. Asegurarse de que el chat de hoy exista 
        const todayKey = formatDateKey();
        if (!chats[todayKey]) {
            chats[todayKey] = [];
            saveData();
        }
        
        // 2. Renderizar la lista de chats, el selector de estados y el botón de pausa
        renderChatList(); 
        renderMoods();
        renderPauseButtons();
        updateMyMoodButton(myMood);
        
        // 3. Inicializar el estado de la pareja
        updatePartnerStatusDisplay(partnerMood, 'offline'); 
        
        // 4. Pedir al servidor el estado de ánimo y conexión real de la pareja
        socket.emit('requestPartnerStatus'); 
    }
    
})();