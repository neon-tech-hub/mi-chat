// =======================================================
// menu.js (SOLO CHATS TEMÁTICOS - VERSIÓN DEFINITIVA)
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

    // Solo guarda las claves temáticas (elimina chats diarios)
    const saveData = () => {
        const filteredChats = {};
        TOPIC_CHATS.forEach(key => {
            if (chats[key]) {
                filteredChats[key] = chats[key];
            }
        });
        
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(filteredChats));
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
    // D. RENDERIZADO Y UI (SOLO TÓPICOS)
    // =======================================================
    
    const renderChatList = () => {
        const chatListContainer = document.getElementById("chatList");
        if (!chatListContainer) return;
        
        chatListContainer.innerHTML = '';
        
        let chatItems = [];
        
        // Solo usar las claves de los chats temáticos
        const keysToShow = TOPIC_CHATS; 

        keysToShow.forEach(chatKey => {
            const chatDay = chats[chatKey];
            // Si por alguna razón el chat temático no existe en 'chats', lo inicializamos para renderizarlo vacío
            if (!chatDay) {
                chats[chatKey] = [];
            } 
            
            // Re-obtener la referencia después de la posible inicialización
            const currentChatMessages = chats[chatKey];

            const isTopic = true; 
            
            // --- 1. Definir Metadata ---
            const lastMessage = currentChatMessages.length > 0 
                ? currentChatMessages[currentChatMessages.length - 1] 
                : { 
                    text: `Toca para empezar a ${chatKey}`, 
                    sender: 'System', 
                    timestamp: currentChatMessages.length > 0 ? currentChatMessages[currentChatMessages.length - 1].timestamp : 0 
                };
            
            const unreadCount = currentChatMessages.filter(m => m.sender !== currentUser && !m.read).length;

            const displayTitle = chatKey.charAt(0).toUpperCase() + chatKey.slice(1); 
            const initial = displayTitle.charAt(0);
            const displayMeta = currentChatMessages.length > 0 ? formatTime(lastMessage.timestamp) : '';
            
            const senderPrefix = lastMessage.sender === currentUser ? 'Tú: ' : 
                                 (lastMessage.sender !== 'System' ? `${partnerName}: ` : '');
            
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
            chatListContainer.innerHTML = '<p class="no-chats">No se encontraron chats temáticos. ¡Revisa la configuración!</p>';
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
                const chatKey = item.dataset.chatKey; 
                sessionStorage.setItem('currentChatKey', chatKey); 
                window.location.href = `chat.html?chatKey=${chatKey}`;
            });
        });
    };

    // Función que renderiza los emojis
    const renderMoods = () => {
        // ✅ CORRECCIÓN: Usar el ID 'moodOptions' del HTML
        const moodList = document.getElementById("moodOptions"); 
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
    // E. MANEJO DE EVENTOS (Modales)
    // =======================================================
    
    const openMoodBtn = document.getElementById('openMoodModal');
    const moodsContainer = document.getElementById('moodsContainer');
    
    if (openMoodBtn && moodsContainer) {
        openMoodBtn.addEventListener('click', () => {
            moodsContainer.classList.add('active');
        });
    }

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
    
    // Solo guarda mensajes si tienen una clave de chat temático
    socket.on("newMessage", (data) => {
        if (data.sender !== getPartnerName()) return; 
        
        // Obtiene la clave, o la fecha de hoy si no viene (la que no queremos guardar)
        const chatKey = data.chatKey || formatDateKey(); 
        
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
    });
    
    socket.on('partnerStatus', (data) => {
        if (data.user === partnerName) {
            updatePartnerStatusDisplay(data.mood, data.status);
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
    // 2. Guardar los datos. La función saveData ahora filtra las claves de fecha automáticamente.
    saveData(); 
    
    // 3. Renderizar la lista de chats y el modal de estados de ánimo
    renderChatList(); 
    renderMoods(); 
    updateMyMoodButton(myMood);
    
    // 4. Inicializar el estado de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    
})(); // Fin del IIFE