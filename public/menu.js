// =======================================================
// menu.js (COMPLETO Y CORREGIDO)
// Lógica para la PÁGINA PRINCIPAL / LISTA DE CHATS
// =======================================================

(function () {
    // -------------------
    // VARIABLES Y UTILIDADES
    // -------------------
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        // En un entorno real, redirigirías a login.html si no hay usuario.
        console.error("Usuario no autenticado.");
        return;
    }

    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    // ✅ CLAVE: Claves de los chats temáticos
    const TOPIC_CHATS = ['discutir', 'consolar', 'debatir']; 
    
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
        '💬': { text: 'Quiero Hablar', class: 'mood-porhablar' },
    };
    
    const getPartnerName = () => partnerName;
    const formatDateKey = (date = new Date()) => date.toISOString().split('T')[0];

    // ✅ NUEVO: Función para obtener la hora formateada
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    // Guarda los datos en localStorage
    const saveData = () => {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    };

    // Actualiza la visualización del estado de la pareja
    const updatePartnerStatusDisplay = (mood, status) => {
        const partnerMoodEmoji = document.getElementById("partnerMoodEmoji");
        const statusHeader = document.getElementById("statusHeader");
        const partnerMoodDisplay = document.getElementById("partnerMoodDisplay");
        const myMoodButton = document.getElementById("openMoodModal");
        
        if (!partnerMoodEmoji || !statusHeader || !partnerMoodDisplay || !myMoodButton) return;
        
        partnerStatus = status;

        let text = "";
        let classList = "";

        if (status === 'paused') {
            text = "Chat Pausado 🚫";
            classList = "status-paused";
            partnerMoodEmoji.textContent = '⏸️'; 
        } else if (status === 'online') {
            // Se muestra el texto del mood si está en línea
            text = `En línea: ${MOODS[mood]?.text || "Desconocido"}`;
            classList = MOODS[mood]?.class || "status-online";
            partnerMoodEmoji.textContent = mood; 
        } else { // 'offline'
            text = "Pareja Desconectada 😴";
            classList = "status-offline";
            partnerMoodEmoji.textContent = '❌'; 
        }

        statusHeader.textContent = text;
        partnerMoodDisplay.className = `partner-mood-display ${classList}`;
        myMoodButton.disabled = false;
    };

    // Actualiza el emoji de mi propio estado de ánimo
    const updateMyMoodButton = (mood) => {
        const myMoodButton = document.getElementById("openMoodModal");
        if (!myMoodButton) return;
        myMoodButton.textContent = mood;
        myMood = mood;
        sessionStorage.setItem("myMood", mood);
        document.getElementById('moodsContainer')?.classList.remove('active');
    };

    // =======================================================
    // D. RENDERIZADO Y UI (CORREGIDO PARA MÚLTIPLES CHATS)
    // =======================================================
    
    const renderChatList = () => {
        const chatListContainer = document.getElementById("chatList");
        if (!chatListContainer) return;
        
        chatListContainer.innerHTML = '';
        
        let chatItems = [];
        
        // Filtrar claves: solo fechas (daily chats) y claves temáticas (topic chats)
        const allChatKeys = Object.keys(chats).filter(key => 
            key.match(/^\d{4}-\d{2}-\d{2}$/) || TOPIC_CHATS.includes(key)
        );

        allChatKeys.forEach(chatKey => {
            const chatDay = chats[chatKey];
            if (!chatDay) return;

            const isTopic = TOPIC_CHATS.includes(chatKey);
            
            // --- 1. Definir Metadata ---
            const lastMessage = chatDay.length > 0 
                ? chatDay[chatDay.length - 1] 
                : { 
                    text: isTopic 
                        ? `Toca para empezar a ${chatKey}` 
                        : 'Toca para empezar tu chat diario.', 
                    sender: 'System', 
                    // Usar timestamp bajo para ordenar si no hay mensajes. Si es chat diario, usamos la fecha.
                    timestamp: chatDay.length > 0 ? chatDay[chatDay.length - 1].timestamp : (isTopic ? 1 : new Date(chatKey).getTime()) 
                };
            
            const unreadCount = chatDay.filter(m => m.sender !== currentUser && !m.read).length;

            let displayTitle = partnerName;
            let initial = partnerName.charAt(0).toUpperCase();
            let displayMeta = ''; // Hora o Fecha

            if (isTopic) {
                // Título es el nombre del tópico ("Discutir")
                displayTitle = chatKey.charAt(0).toUpperCase() + chatKey.slice(1); 
                initial = displayTitle.charAt(0);
                displayMeta = chatDay.length > 0 ? formatTime(lastMessage.timestamp) : '';
            } else {
                // Chat Diario (Fecha)
                const todayKey = formatDateKey();
                displayTitle = todayKey === chatKey ? 'Chat Diario Hoy' : partnerName; // Puede ser el nombre de la pareja o 'Chat Diario Hoy'
                initial = partnerName.charAt(0).toUpperCase();
                displayMeta = chatKey === todayKey
                    ? formatTime(lastMessage.timestamp) // Mostrar hora para "Hoy"
                    : new Date(chatKey).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            }
            
            // Determinar si el último mensaje fue mío o de la pareja
            const senderPrefix = lastMessage.sender === currentUser ? 'Tú: ' : 
                                 (lastMessage.sender !== 'System' ? `${partnerName}: ` : '');
            
            // Truncar el mensaje
            const truncatedText = lastMessage.text.substring(0, 40) + (lastMessage.text.length > 40 ? '...' : '');

            chatItems.push({
                key: chatKey,
                title: displayTitle,
                initial: initial,
                lastMessage: { prefix: senderPrefix, text: truncatedText, timestamp: lastMessage.timestamp },
                unreadCount: unreadCount,
                meta: displayMeta,
                isTopic: isTopic
            });
        });

        // 2. Ordenar la lista por timestamp (más reciente primero)
        chatItems.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
        
        if (chatItems.length === 0) {
            chatListContainer.innerHTML = '<p class="no-chats">¡Aún no hay chats! Selecciona tu estado para empezar.</p>';
            return;
        }

        // 3. Generar el HTML
        chatItems.forEach(item => {
            const unreadBadge = item.unreadCount > 0 ? `<div class="unread-count">${item.unreadCount}</div>` : '';
            const metaHtml = item.meta ? `<div class="chat-meta-info">${item.meta}</div>` : '';

            const chatItemHTML = `
                <div class="chat-item ${item.unreadCount > 0 ? 'unread' : ''}" data-chat-key="${item.key}">
                    <div class="chat-avatar">${item.initial}</div>
                    <div class="meta">
                        <div class="chat-name-line">
                            <div class="chat-name">${item.title}</div>
                            ${metaHtml}
                        </div>
                        <div class="chat-last">
                            <span class="sender-prefix">${item.lastMessage.prefix}</span>
                            <span class="message-text">${item.lastMessage.text}</span>
                        </div>
                    </div>
                    <div class="status-info">
                        ${unreadBadge}
                    </div>
                </div>
            `;
            chatListContainer.innerHTML += chatItemHTML;
        });

        // 4. Agregar Event Listeners
        chatListContainer.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                // ✅ CORRECCIÓN CLAVE: Usamos .dataset.chatKey (camelCase)
                const chatKey = item.dataset.chatKey; 
                
                // Almacenar la clave para que chat.js la use
                sessionStorage.setItem('currentChatKey', chatKey); 
                window.location.href = `chat.html?chatKey=${chatKey}`;
            });
        });
    };

    // Renderiza los botones de estado de ánimo en el modal
    const renderMoods = () => {
        const moodList = document.getElementById("moodList");
        if (!moodList) return;
        
        moodList.innerHTML = '';

        Object.entries(MOODS).forEach(([emoji, data]) => {
            const button = document.createElement("button");
            button.className = `mood-btn ${data.class}`;
            button.textContent = emoji;
            button.dataset.mood = emoji;
            button.title = data.text;
            
            button.addEventListener('click', () => {
                updateMyMoodButton(emoji);
                // Cerrar modal
                const moodsContainer = document.getElementById('moodsContainer');
                if (moodsContainer) moodsContainer.classList.remove('active');
                
                // Emitir el evento al servidor
                socket.emit('moodChanged', { 
                    user: currentUser, 
                    mood: emoji,
                    status: 'online' 
                });
            });

            moodList.appendChild(button);
        });
    };
    
    // =======================================================
    // E. MANEJO DE EVENTOS (Modales)
    // =======================================================
    
    // Manejo del modal de estados de ánimo
    const openMoodBtn = document.getElementById('openMoodModal');
    const moodsContainer = document.getElementById('moodsContainer');
    
    if (openMoodBtn && moodsContainer) {
        openMoodBtn.addEventListener('click', () => {
            moodsContainer.classList.add('active');
        });
    }

    // Listener para cerrar Modales (La 'X')
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

    // =======================================================
    // F. LÓGICA DE SOCKET.IO
    // =======================================================
    
    socket.on('connect', () => {
        console.log("Socket.IO conectado en Menu:", socket.id);
        
        socket.emit('userConnected', { 
            user: currentUser, 
            mood: myMood,
        });

        socket.emit('requestPartnerStatus', { targetUser: partnerName });
    });

    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });

    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });

    socket.on("chatPaused", (data) => {
        if (data.sender === getPartnerName()) {
            updatePartnerStatusDisplay(partnerMood, 'paused');
            alert(`El chat fue pausado por ${getPartnerName()} por ${data.duration} minutos.`);
        }
    });
    
    // ✅ Nuevo mensaje: usa data.chatKey si existe, sino, usa el diario de hoy.
    socket.on("newMessage", (data) => {
        if (data.sender !== getPartnerName()) return; 
        
        const chatKey = data.chatKey || formatDateKey(); 
        
        if (!chats[chatKey]) {
            chats[chatKey] = [];
        }
        chats[chatKey].push({ ...data.message, sender: data.sender, read: false }); 
        saveData();
        
        renderChatList();
    });
    
    socket.on('partnerStatus', (data) => {
        if (data.user === partnerName) {
            updatePartnerStatusDisplay(data.mood, data.status);
        }
    });


    // =======================================================
    // G. INICIALIZACIÓN DE menu.html (INCLUYE CHATS TEMÁTICOS)
    // =======================================================

    // 1. Asegurarse de que el chat de hoy Y los chats de tópicos existan 
    const todayKey = formatDateKey();
    if (!chats[todayKey]) {
        chats[todayKey] = [];
    }
    // ✅ CLAVE: Inicializar los chats temáticos si no existen
    TOPIC_CHATS.forEach(key => {
        if (!chats[key]) {
            chats[key] = [];
        }
    });
    saveData();
    
    // 2. Renderizar la lista de chats y el modal de estados de ánimo
    renderChatList(); 
    renderMoods();
    updateMyMoodButton(myMood);
    
    // 3. Inicializar el estado de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    
})(); // Fin del IIFE