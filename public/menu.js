// =======================================================
// menu.js (SOLO CHATS TEMÁTICOS)
// Lógica para la PÁGINA PRINCIPAL / LISTA DE CHATS
// =======================================================

(function () {
    // -------------------
    // VARIABLES Y UTILIDADES
    // -------------------
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        console.error("Usuario no autenticado.");
        return;
    }

    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    // ✅ CLAVE: Solo las claves de los chats temáticos
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

    // Función para obtener la hora formateada
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    // Guarda los datos en localStorage
    const saveData = () => {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    };

    // Actualiza la visualización del estado de la pareja (SIN CAMBIOS)
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

    // Actualiza el emoji de mi propio estado de ánimo (SIN CAMBIOS)
    const updateMyMoodButton = (mood) => {
        const myMoodButton = document.getElementById("openMoodModal");
        if (!myMoodButton) return;
        myMoodButton.textContent = mood;
        myMood = mood;
        sessionStorage.setItem("myMood", mood);
        document.getElementById('moodsContainer')?.classList.remove('active');
    };

    // =======================================================
    // D. RENDERIZADO Y UI (SOLO TÓPICOS)
    // =======================================================
    
    const renderChatList = () => {
        const chatListContainer = document.getElementById("chatList");
        if (!chatListContainer) return;
        
        chatListContainer.innerHTML = '';
        
        let chatItems = [];
        
        // ✅ CLAVE: Solo usar las claves de los chats temáticos
        const keysToShow = TOPIC_CHATS; 

        keysToShow.forEach(chatKey => {
            const chatDay = chats[chatKey];
            if (!chatDay) return;

            const isTopic = TOPIC_CHATS.includes(chatKey); // Siempre true en esta nueva lógica
            
            // --- 1. Definir Metadata ---
            const lastMessage = chatDay.length > 0 
                ? chatDay[chatDay.length - 1] 
                : { 
                    // Mensaje inicial para chats vacíos
                    text: `Toca para empezar a ${chatKey}`, 
                    sender: 'System', 
                    // Usamos un timestamp muy bajo (0) para que los vacíos queden al final si se mezclan
                    timestamp: chatDay.length > 0 ? chatDay[chatDay.length - 1].timestamp : 0 
                };
            
            const unreadCount = chatDay.filter(m => m.sender !== currentUser && !m.read).length;

            // Para chats temáticos, el título es el tópico y la inicial es la primera letra
            const displayTitle = chatKey.charAt(0).toUpperCase() + chatKey.slice(1); 
            const initial = displayTitle.charAt(0);
            const displayMeta = chatDay.length > 0 ? formatTime(lastMessage.timestamp) : '';
            
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
            chatListContainer.innerHTML = '<p class="no-chats">Error: No se encontraron chats temáticos. ¡Revisa la configuración!</p>';
            return;
        }

        // 3. Generar el HTML (SIN CAMBIOS)
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

        // 4. Agregar Event Listeners (SIN CAMBIOS)
        chatListContainer.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatKey = item.dataset.chatKey; 
                sessionStorage.setItem('currentChatKey', chatKey); 
                window.location.href = `chat.html?chatKey=${chatKey}`;
            });
        });
    };

    // Renderiza los botones de estado de ánimo en el modal (SIN CAMBIOS)
    const renderMoods = () => {
        // ... (Tu código actual de renderMoods)
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
                const moodsContainer = document.getElementById('moodsContainer');
                if (moodsContainer) moodsContainer.classList.remove('active');
                
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
    // E. MANEJO DE EVENTOS (Modales - SIN CAMBIOS)
    // =======================================================
    
    // Manejo del modal de estados de ánimo
    const openMoodBtn = document.getElementById('openMoodModal');
    const moodsContainer = document.getElementById('moodsContainer');
    
    if (openMoodBtn && moodsContainer) {
        openMoodBtn.addEventListener('click', () => {
            moodsContainer.classList.add('active');
        });
    }

    // Listener para cerrar Modales
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
    // F. LÓGICA DE SOCKET.IO (SIN CAMBIOS SIGNIFICATIVOS)
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
    
    socket.on("newMessage", (data) => {
        if (data.sender !== getPartnerName()) return; 
        
        // Usa data.chatKey si existe, sino, usa el diario de hoy (aunque no se muestre)
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
    // G. INICIALIZACIÓN DE menu.html (SOLO TEMÁTICOS)
    // =======================================================

    // ✅ CLAVE: Solo inicializar los chats temáticos si no existen
    TOPIC_CHATS.forEach(key => {
        if (!chats[key]) {
            chats[key] = [];
        }
    });
    // Eliminamos la inicialización del chat diario por defecto
    saveData();
    
    // 2. Renderizar la lista de chats y el modal de estados de ánimo
    renderChatList(); 
    renderMoods();
    updateMyMoodButton(myMood);
    
    // 3. Inicializar el estado de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    
})(); // Fin del IIFE