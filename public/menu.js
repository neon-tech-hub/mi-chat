// =======================================================
// menu.js
// Lógica para la PÁGINA PRINCIPAL / LISTA DE CHATS
// =======================================================

(function () {
    // -------------------
    // VARIABLES Y UTILIDADES
    // -------------------
    const currentUser = sessionStorage.getItem("currentUser");
    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    let myMood = sessionStorage.getItem("myMood") || "😴";
    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; // 'online', 'paused', 'offline'
    
    // Variables para Socket.IO 🟢 CORRECCIÓN: Usar la URL de Render
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
            text = MOODS[mood]?.text || "En línea";
            classList = MOODS[mood]?.class || "status-online";
            partnerMoodEmoji.textContent = mood; 
        } else { // 'offline'
            text = "Desconectado/a 😴";
            classList = "status-offline";
            partnerMoodEmoji.textContent = '❌'; 
        }

        statusHeader.textContent = text;
        partnerMoodDisplay.className = `partner-mood-display ${classList}`;

        // El botón de mi estado siempre debe funcionar en el menú
        myMoodButton.disabled = false;
    };

    // Actualiza el emoji de mi propio estado de ánimo
    const updateMyMoodButton = (mood) => {
        const myMoodButton = document.getElementById("openMoodModal");
        if (!myMoodButton) return;
        myMoodButton.textContent = mood;
        myMood = mood;
        sessionStorage.setItem("myMood", mood);
    };

    // =======================================================
    // D. RENDERIZADO Y UI
    // =======================================================
    
    // Renderiza la lista de chats
    const renderChatList = () => {
        const chatListContainer = document.getElementById("chatList");
        if (!chatListContainer) return;
        
        chatListContainer.innerHTML = '';
        const sortedKeys = Object.keys(chats).sort().reverse(); 

        if (sortedKeys.length === 0) {
            chatListContainer.innerHTML = '<p class="no-chats">¡Aún no hay chats! Selecciona tu estado para empezar.</p>';
            return;
        }

        sortedKeys.forEach(dateKey => {
            const chatDay = chats[dateKey];
            if (chatDay && chatDay.length > 0) {
                const lastMessage = chatDay[chatDay.length - 1];
                const unreadCount = chatDay.filter(m => m.sender !== currentUser && !m.read).length;

                const chatItem = document.createElement("div");
                chatItem.className = "chat-item";
                chatItem.dataset.chatKey = dateKey;
                
                // 🔴 Apuntar a chat.html con el parámetro
                chatItem.addEventListener('click', () => {
                    window.location.href = `chat.html?chatKey=${dateKey}`;
                });

                let dateText = dateKey;
                if (dateKey === formatDateKey()) {
                    dateText = "Hoy";
                }

                chatItem.innerHTML = `
                    <div class="chat-avatar">${getPartnerName()[0]}</div>
                    <div class="meta">
                        <div class="chat-name">${getPartnerName()}</div>
                        <div class="chat-last">${lastMessage.text}</div>
                    </div>
                    <div class="status-info">
                        <div class="chat-date">${dateText}</div>
                        ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                    </div>
                `;
                chatListContainer.appendChild(chatItem);
            }
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
                
                // 🟢 Emitir el evento al servidor
                socket.emit('moodChanged', { 
                    user: currentUser, 
                    mood: emoji,
                    status: 'online' 
                });
            });

            moodList.appendChild(button);
        });
    };
    
    // 🔴 NOTA: Eliminada la función renderPauseButtons() y su lógica.


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
            // El target puede ser el botón mismo o el span interno 'X'
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

        socket.emit('requestPartnerStatus'); 
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

    // Mantener la recepción de pausa, por si la pareja lo activa desde su lado.
    socket.on("chatPaused", (data) => {
        if (data.sender === getPartnerName()) {
            updatePartnerStatusDisplay(partnerMood, 'paused');
            alert(`El chat fue pausado por ${getPartnerName()} por ${data.duration} minutos.`);
        }
    });
    
    socket.on("newMessage", (data) => {
        if (data.sender !== getPartnerName()) return; 
        
        const todayKey = formatDateKey();
        if (!chats[todayKey]) {
            chats[todayKey] = [];
        }
        chats[todayKey].push({ ...data.message, read: false }); 
        saveData();
        
        renderChatList();
    });


    // =======================================================
    // G. INICIALIZACIÓN DE menu.html
    // =======================================================

    // 1. Asegurarse de que el chat de hoy exista 
    const todayKey = formatDateKey();
    if (!chats[todayKey]) {
        chats[todayKey] = [];
        saveData();
    }
    
    // 2. Renderizar la lista de chats y el modal de estados de ánimo (¡Ahora sí funcionan!)
    renderChatList(); 
    renderMoods();
    // 🔴 renderPauseButtons() ha sido eliminada.
    updateMyMoodButton(myMood);
    
    // 3. Inicializar el estado de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    
})(); // Fin del IIFE