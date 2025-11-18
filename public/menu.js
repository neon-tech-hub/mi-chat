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
    
    // Tiempos de pausa en minutos
    const PAUSE_TIMES = [
        { value: 10, text: "10 min" },
        { value: 30, text: "30 min" },
        { value: 60, text: "1 hora" },
    ];

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
        
        partnerStatus = status; // Actualiza el estado local

        let text = "";
        let classList = "";

        if (status === 'paused') {
            text = "Chat Pausado 🚫";
            classList = "status-paused";
            partnerMoodEmoji.textContent = '⏸️'; // Símbolo de pausa
        } else if (status === 'online') {
            text = MOODS[mood]?.text || "En línea";
            classList = MOODS[mood]?.class || "status-online";
            partnerMoodEmoji.textContent = mood; // El emoji de estado de ánimo
        } else { // 'offline'
            text = "Desconectado/a 😴";
            classList = "status-offline";
            partnerMoodEmoji.textContent = '❌'; // Símbolo de desconexión
        }

        // Actualiza el texto y las clases del header de estado
        statusHeader.textContent = text;
        partnerMoodDisplay.className = `partner-mood-display ${classList}`;

        // Habilita/Deshabilita el botón de estado de ánimo propio solo si la pareja NO está en pausa
        myMoodButton.disabled = status === 'paused';
    };

    // Actualiza el emoji de mi propio estado de ánimo
    const updateMyMoodButton = (mood) => {
        const myMoodButton = document.getElementById("openMoodModal");
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
        chatListContainer.innerHTML = '';
        const sortedKeys = Object.keys(chats).sort().reverse(); // Ordena de más nuevo a más viejo

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
                document.getElementById('moodsContainer').classList.remove('active');
                
                // 🟢 Emitir el evento al servidor
                socket.emit('moodChanged', { 
                    user: currentUser, 
                    mood: emoji,
                    // Si el chat está pausado localmente, no se debe cambiar el estado a 'online'
                    status: 'online' 
                });
            });

            moodList.appendChild(button);
        });
    };
    
    // Renderiza los botones de tiempo de pausa
    const renderPauseButtons = () => {
        const pauseTimeButtons = document.getElementById("pauseTimeButtons");
        pauseTimeButtons.innerHTML = '';
        
        PAUSE_TIMES.forEach(time => {
            const button = document.createElement("button");
            button.className = 'btn secondary pause-btn';
            button.textContent = time.text;
            
            button.addEventListener('click', () => {
                // Cerrar modal
                document.getElementById('pauseTimeModal').classList.remove('active');
                
                // 🟢 Emitir el evento de pausa al servidor
                socket.emit('pauseChat', {
                    user: currentUser,
                    duration: time.value // duración en minutos
                });

                // Actualizar mi estado visual a Pausado
                updateMyMoodButton('⏸️'); // O el emoji que desees para pausa
                updatePartnerStatusDisplay(partnerMood, 'paused'); 
            });
            pauseTimeButtons.appendChild(button);
        });
    };


    // =======================================================
    // E. MANEJO DE EVENTOS (Modales, etc.)
    // =======================================================
    
    // Manejo de Modales
    document.getElementById('openMoodModal').addEventListener('click', () => {
        document.getElementById('moodsContainer').classList.add('active');
    });

    document.getElementById('openPauseTimeModal').addEventListener('click', () => {
        document.getElementById('pauseTimeModal').classList.add('active');
    });

    document.querySelectorAll('.close-modal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetId = e.target.dataset.modalTarget;
            document.getElementById(targetId).classList.remove('active');
        });
    });

    // =======================================================
    // F. LÓGICA DE SOCKET.IO
    // =======================================================
    
    // 1. Conexión Establecida
    socket.on('connect', () => {
        console.log("Socket.IO conectado en Menu:", socket.id);
        
        // 🟢 REGISTRO CRÍTICO: Al conectarse, enviamos nuestro nombre de usuario y mood
        socket.emit('userConnected', { 
            user: currentUser, 
            mood: myMood,
        });

        // 🟢 SOLICITAR ESTADO: Pedimos el estado actual de la pareja
        socket.emit('requestPartnerStatus'); 
    });

    // 2. Recepción de ESTADO DE ÁNIMO
    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            // Usamos el status local (online/offline/paused)
            updatePartnerStatusDisplay(data.mood, partnerStatus); 
        }
    });

    // 3. Recepción de ESTADO DE CONEXIÓN
    socket.on("statusChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            // Actualizamos la visualización con el nuevo status (online/offline)
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });

    // 4. Recepción de PAUSA DE CHAT
    socket.on("chatPaused", (data) => {
        if (data.sender === getPartnerName()) {
            // Si la pareja pausó, actualizamos el estado visual
            updatePartnerStatusDisplay(partnerMood, 'paused');
            alert(`El chat fue pausado por ${getPartnerName()} por ${data.duration} minutos.`);
        }
    });
    
    // 5. Recepción de MENSAJE NUEVO
    socket.on("newMessage", (data) => {
        // Ignoramos mensajes que no son de la pareja
        if (data.sender !== getPartnerName()) return; 
        
        // Añadir el mensaje al chat local
        const todayKey = formatDateKey();
        if (!chats[todayKey]) {
            chats[todayKey] = [];
        }
        // Marcar el mensaje como no leído por defecto al recibir
        chats[todayKey].push({ ...data, read: false }); 
        saveData();
        
        // Renderizar la lista nuevamente para mostrar el nuevo mensaje y el contador de no leídos
        renderChatList();
        
        // Notificación visual/auditiva si la app está en segundo plano (Opcional)
        if (document.hidden) {
             // Lógica de notificación push o sonido si es posible
        }
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
    
    // 2. Renderizar la lista de chats y los modales
    renderChatList(); 
    renderMoods();
    renderPauseButtons();
    updateMyMoodButton(myMood);
    
    // 3. Inicializar el estado de la pareja (asumir offline hasta la conexión)
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    // NOTA: La lógica de conexión y solicitud de estado real (requestPartnerStatus)
    // ocurre dentro del 'socket.on("connect", ...)' para asegurar que el socket esté listo.
    
    
})(); // Fin del IIFE