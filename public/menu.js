// =======================================================
// menu.js (SOLO CHATS TEMÁTICOS - VERSIÓN DEFINITIVA)
// Lógica para la PÁGINA PRINCIPAL / LISTA DE CHATS
// =======================================================

(function () {
    // -------------------\
    // VARIABLES Y UTILIDADES
    // -------------------\
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        console.error("Usuario no autenticado.");
        return;
    }

    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    // ✅ CLAVE: Solo las claves de los chats temáticos
    const TOPIC_CHATS = ['discutir', 'consolar', 'debatir']; 
    const CHAT_TITLES = {
        'discutir': 'Desahogo (Para temas difíciles)',
        'consolar': 'Apoyo (Para momentos de tristeza)',
        'debatir': 'Tópico Neutro (Para dialogar)'
    };
    const CHAT_ICONS = {
        'discutir': '🔥',
        'consolar': '🫂',
        'debatir': '💡'
    };
    
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    let myMood = sessionStorage.getItem("myMood") || "😴";
    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; 
    
    // Variables para Socket.IO
    const SERVER_URL = 'https://mi-chat-omr7.onrender.com';
    const socket = io(SERVER_URL); 

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
    // MANEJO DE ALMACENAMIENTO Y FORMATO
    // -------------------\

    function saveData() {
        // Al guardar, solo se guardan los chats temáticos. 
        // Se limpian claves viejas si no están en TOPIC_CHATS.
        const filteredChats = {};
        TOPIC_CHATS.forEach(key => {
            if (chats[key]) {
                filteredChats[key] = chats[key];
            }
        });
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(filteredChats));
    }

    function formatDateForDisplay(dateString) {
        if (dateString in CHAT_TITLES) return CHAT_TITLES[dateString];
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // -------------------\
    // RENDERIZADO DE INTERFAZ
    // -------------------\

    function updateMyMoodButton(mood) {
        const btn = document.getElementById('openMoodModal');
        if (btn) {
            btn.textContent = mood;
            btn.className = 'my-mood-btn ' + (MOODS[mood] ? MOODS[mood].class : '');
        }
    }

    function updatePartnerStatusDisplay(mood, status) {
        const moodEmoji = document.getElementById('partnerMoodEmoji');
        const statusHeader = document.getElementById('statusHeader');
        const partnerMoodDisplay = document.getElementById('partnerMoodDisplay');
        
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
                statusHeader.textContent = `Pareja en línea (${MOODS[mood]?.text || '?'})`;
                statusHeader.classList.remove('offline');
                statusHeader.classList.add('online');
            } else if (status === 'paused') {
                statusHeader.textContent = `Chat en pausa (Mood: ${MOODS[mood]?.text || '?'})`;
                statusHeader.classList.add('offline'); // Usar color de offline/gris para pausa
                statusHeader.classList.remove('online');
            } else { // offline
                statusHeader.textContent = `Pareja Desconectada`;
                statusHeader.classList.add('offline');
                statusHeader.classList.remove('online');
            }
        }
    }

    function renderMoods() {
        const moodOptions = document.getElementById('moodOptions');
        if (!moodOptions) return;
        
        moodOptions.innerHTML = '';
        Object.keys(MOODS).forEach(emoji => {
            const mood = MOODS[emoji];
            const button = document.createElement('button');
            button.className = `mood-btn ${mood.class}`;
            button.textContent = emoji;
            button.title = mood.text;
            button.setAttribute('data-mood-emoji', emoji);
            
            button.addEventListener('click', () => handleMoodSelection(emoji));
            moodOptions.appendChild(button);
        });
    }
    
    function renderChatList() {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;
        
        chatList.innerHTML = '';
        
        TOPIC_CHATS.forEach(chatKey => {
            const chatMessages = chats[chatKey] || [];
            const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
            
            // Contar mensajes no leídos del compañero
            const unreadCount = chatMessages.filter(m => m.sender === partnerName && !m.read).length;
            const hasUnread = unreadCount > 0;
            
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.setAttribute('data-chat-key', chatKey);

            chatItem.innerHTML = `
                <div class="chat-icon">${CHAT_ICONS[chatKey]}</div>
                <div class="chat-info">
                    <div class="chat-title">${CHAT_TITLES[chatKey]}</div>
                    <div class="last-message">${lastMessage ? lastMessage.text.substring(0, 50) + (lastMessage.text.length > 50 ? '...' : '') : 'Aún no hay mensajes'}</div>
                </div>
                ${hasUnread ? `<div class="unread-count">${unreadCount}</div>` : ''}
            `;
            
            chatItem.addEventListener('click', () => openChat(chatKey));
            chatList.appendChild(chatItem);
        });
    }


    // -------------------\
    // MANEJADORES DE EVENTOS
    // -------------------\

    function handleMoodSelection(emoji) {
        myMood = emoji;
        sessionStorage.setItem("myMood", myMood);
        updateMyMoodButton(myMood);
        
        // 1. Ocultar el modal
        const modal = document.getElementById('moodsContainer');
        if (modal) modal.classList.remove('active');
        
        // 2. Emitir el cambio a la pareja
        socket.emit("changeMood", { mood: myMood });
    }
    
    function openChat(chatKey) {
        // Guardar la clave del chat para que chat.js la cargue
        sessionStorage.setItem('currentChatDate', chatKey);
        window.location.href = `chat.html?chatKey=${chatKey}`;
    }
    
    // Manejador de Modales
    document.getElementById('openMoodModal')?.addEventListener('click', () => {
        document.getElementById('moodsContainer').classList.add('active');
    });
    
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalTargetId = e.target.getAttribute('data-modal-target');
            if (modalTargetId) {
                document.getElementById(modalTargetId).classList.remove('active');
            }
        });
    });

    // -------------------\
    // MANEJADORES DE SOCKET.IO (RECEPCIÓN)
    // -------------------\
    
    // 1. Recibe el estado inicial al registrarse el usuario
    socket.on("connect", () => {
        console.log("Conectado al servidor.");
        // Registrar el usuario y el mood actual
        socket.emit("registerUser", { user: currentUser, mood: myMood });
        
        // Solicitar estado de la pareja (necesario si se conecta y la pareja ya estaba online)
        socket.emit('requestPartnerStatus', { target: partnerName });
    });
    
    // 2. Recepción de cambio de estado de Ánimo del compañero
    socket.on("moodChanged", (data) => {
        if (data.sender === partnerName) {
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });
    
    // 3. Recepción de cambio de estado (online/offline)
    socket.on("statusChanged", (data) => {
        if (data.sender === partnerName) {
            // Se mantiene el mood actual de la pareja, solo se cambia el status
            updatePartnerStatusDisplay(partnerMood, data.status);
        }
    });

    // 4. Recepción de estado inicial de la pareja
    socket.on('partnerStatus', (data) => {
        if (data.user === partnerName) {
            updatePartnerStatusDisplay(data.mood, data.status);
        }
    });
    
    // 5. Recepción de un Nuevo Mensaje
    socket.on("newMessage", (data) => {
        if (data.sender !== partnerName) return; 
        
        // 🔴 CORRECCIÓN: Usar data.chatId, no formatDateKey, para mensajes temáticos
        const chatKey = data.chatId; 
        
        // Si el mensaje NO pertenece a un chat temático, lo ignoramos y salimos.
        if (!TOPIC_CHATS.includes(chatKey)) {
             console.log(`Mensaje del chat diario ignorado: ${chatKey}`);
             return; 
        }

        if (!chats[chatKey]) {
            chats[chatKey] = [];
        }
        chats[chatKey].push({ ...data.message, sender: data.sender, read: false }); 
        saveData();
        
        renderChatList();
        
        // Notificación visual de nuevo mensaje (opcional, por ahora solo re-render)
    });
    
    // 6. Recepción de CHAT LEÍDO (Marcar como leídos)
    socket.on('messagesRead', (data) => {
        // No hay necesidad de actuar en menu.js, ya que la lectura solo importa en chat.js.
        // Pero podríamos re-renderizar por si el unreadCount de un chat temático desaparece.
        if (data.reader === partnerName && TOPIC_CHATS.includes(data.chatKey)) {
             // Ya que el chat se abrió, el recuento de no leídos es 0. 
             // Al no tener los mensajes aquí, solo re-renderizamos.
             renderChatList();
        }
    });


    // =======================================================
    // G. INICIALIZACIÓN DE menu.html
    // =======================================================

    // 1. Inicializar los chats temáticos si no existen
    TOPIC_CHATS.forEach(key => {
        if (!chats[key]) {
            chats[key] = [];
        }
    });
    // 2. Guardar los datos. 
    saveData(); 
    
    // 3. Renderizar la lista de chats y el modal de estados de ánimo
    renderChatList(); 
    renderMoods(); 
    updateMyMoodButton(myMood);

})(); // Fin de la función anónima.