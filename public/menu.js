// =======================================================
// menu.js (COMPLETO Y CORREGIDO)
// =======================================================

(function () {
    // -------------------
    // VARIABLES Y UTILIDADES
    // -------------------
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return; // Si no hay usuario, la redirección en menu.html lo maneja
    
    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    const partnerInitial = partnerName.charAt(0).toUpperCase(); // Obtener la inicial
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    let myMood = sessionStorage.getItem("myMood") || "😴";
    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; // 'online', 'paused', 'offline'
    
    // Variables para Socket.IO 🟢 CORRECCIÓN: Usar la URL de Render (si aplica)
    const SERVER_URL = 'https://mi-chat-omr7.onrender.com'; // O cambiar a 'http://localhost:3000' para desarrollo local
    const socket = io(SERVER_URL); 

    const MOODS = {
        '😍': { text: 'Enamorado', class: 'mood-enamorado' },
        '😊': { text: 'Feliz', class: 'mood-happy' },
        '😴': { text: 'Cansado/a', class: 'mood-cansado' },
        '😡': { text: 'Enojado/a', class: 'mood-enojado' },
        '😔': { text: 'Triste', class: 'mood-triste' },
        '😫': { text: 'Estresado/a' }
    };

    // Elementos del DOM
    const openMoodModalBtn = document.getElementById("openMoodModal");
    const moodsContainer = document.getElementById("moodsContainer");
    const moodOptionsContainer = document.getElementById("moodOptions");
    const myMoodButton = document.querySelector(".my-mood-btn");
    const chatListContainer = document.getElementById("chatList");
    const partnerMoodDisplay = document.getElementById("partnerMoodDisplay");
    const partnerMoodEmoji = document.getElementById("partnerMoodEmoji");
    const statusHeader = document.getElementById("statusHeader");
    
    // Función de Guardado
    const saveData = () => {
        localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
        sessionStorage.setItem("myMood", myMood);
        sessionStorage.setItem("partnerMood", partnerMood);
    };

    // Función de formato de fecha para la clave de localStorage
    const formatDateKey = () => new Date().toISOString().split('T')[0];
    
    // Función para obtener la hora formateada
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    // -------------------
    // A. RENDERING
    // -------------------
    
    const updateMyMoodButton = (mood) => {
        myMoodButton.textContent = mood;
        myMood = mood;
        sessionStorage.setItem("myMood", myMood);
        
        // Cierra el modal automáticamente al seleccionar
        moodsContainer.classList.remove('active');
    };

    const updatePartnerStatusDisplay = (mood, status) => {
        partnerMood = mood;
        partnerStatus = status;
        sessionStorage.setItem("partnerMood", partnerMood);
        
        partnerMoodDisplay.className = 'partner-mood-display'; // Reset de clases
        
        // 1. Emoji y color
        partnerMoodEmoji.textContent = mood;
        const moodData = MOODS[mood];
        if (moodData) {
            partnerMoodDisplay.classList.add(moodData.class);
        }

        // 2. Texto de estado
        if (status === 'online') {
            statusHeader.textContent = `En Línea: ${moodData ? moodData.text : 'Desconocido'}`;
            statusHeader.classList.remove('paused', 'offline');
        } else if (status === 'paused') {
            statusHeader.textContent = 'Chat Pausado 🚫';
            statusHeader.classList.add('paused');
            statusHeader.classList.remove('offline');
        } else { // offline
            statusHeader.textContent = 'Pareja Desconectada';
            statusHeader.classList.add('offline');
            statusHeader.classList.remove('paused');
        }
    };

    const renderMoods = () => {
        moodOptionsContainer.innerHTML = Object.keys(MOODS).map(emoji => `
            <button class="mood-option-btn ${MOODS[emoji].class}" data-mood="${emoji}" aria-label="${MOODS[emoji].text}">
                ${emoji} <span class="mood-text">${MOODS[emoji].text}</span>
            </button>
        `).join('');

        moodOptionsContainer.querySelectorAll('.mood-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newMood = btn.dataset.mood;
                updateMyMoodButton(newMood);
                socket.emit("moodChanged", newMood);
            });
        });
    };

    const renderChatList = () => {
        chatListContainer.innerHTML = '';
        // Obtenemos todas las claves (fechas) y las ordenamos por más reciente primero
        const allDateKeys = Object.keys(chats);
        const sortedKeys = allDateKeys.sort().reverse(); 

        if (sortedKeys.length === 0) {
            chatListContainer.innerHTML = '<p class="no-chats">¡Aún no hay chats! Selecciona tu estado para empezar.</p>';
            return;
        }

        // 🟢 MODIFICACIÓN CLAVE: Iterar sobre todas las fechas para mostrar cada chat diario
        sortedKeys.forEach(dateKey => {
            const chatDay = chats[dateKey];
            const lastMessage = chatDay[chatDay.length - 1];
            
            if (!lastMessage) return; // No hay mensajes para ese día

            // Contar mensajes no leídos (solo mensajes de la pareja)
            const unreadCount = chatDay.filter(msg => msg.sender === partnerName && !msg.read).length;
            const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
            
            // Determinar si el último mensaje fue mío o de la pareja
            const senderPrefix = lastMessage.sender === currentUser ? 'Tú: ' : `${partnerName}: `;
            
            // Formatear fecha
            const displayDate = dateKey === formatDateKey() 
                ? 'Hoy' 
                : new Date(dateKey).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

            // Truncar el mensaje
            const truncatedText = lastMessage.text.substring(0, 40) + (lastMessage.text.length > 40 ? '...' : '');

            // 🟢 ESTRUCTURA HTML DEL CHAT ITEM (NUEVO DISEÑO)
            const chatItemHTML = `
                <div class="chat-item" data-date-key="${dateKey}">
                    
                    <div class="chat-avatar-circle">${partnerInitial}</div>
                    
                    <div class="chat-info-content">
                        <div class="chat-title-line">
                            <span class="chat-contact-name">${partnerName}</span>
                            <span class="chat-date">${displayDate}</span>
                        </div>
                        <p class="last-message">
                            <span class="sender-prefix">${senderPrefix}</span>
                            <span class="message-text">${truncatedText}</span>
                        </p>
                    </div>

                    <div class="chat-meta">
                        <div class="chat-time">${formatTime(lastMessage.timestamp)}</div>
                        ${unreadBadge}
                    </div>
                </div>
            `;
            chatListContainer.innerHTML += chatItemHTML;
        });

        // Evento para abrir el chat
        chatListContainer.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const dateKey = item.dataset.dateKey;
                // Almacenar la clave del chat a abrir
                sessionStorage.setItem('currentChatDate', dateKey);
                window.location.href = 'chat.html';
            });
        });
    };

    // -------------------
    // B. MANEJADORES DE EVENTOS
    // -------------------

    // 1. Abrir Modal de Mood
    openMoodModalBtn.addEventListener('click', () => {
        moodsContainer.classList.add('active');
    });

    // 2. Cerrar Modal (usando delegación de eventos)
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.modalTarget;
            document.getElementById(targetId).classList.remove('active');
        });
    });

    // -------------------
    // C. SOCKET.IO CLIENTE
    // -------------------
    
    // 1. Notificación de conexión al servidor (para establecer identidad)
    socket.on('connect', () => {
        console.log("Conectado al servidor. Enviando login.");
        socket.emit("login", currentUser, myMood);
        // Solicitar el estado inicial de la pareja
        socket.emit('requestPartnerStatus', partnerName); 
    });
    
    // 2. Recepción del estado de la pareja (inicial o por solicitud)
    socket.on('partnerStatus', (data) => {
        if (data.user === partnerName) {
            updatePartnerStatusDisplay(data.mood, data.status);
        }
    });

    // 3. Recepción de cambio de estado de la pareja (online, offline, mood)
    socket.on("statusChanged", (data) => {
        if (data.sender === partnerName) {
            updatePartnerStatusDisplay(data.mood || partnerMood, data.status);
        }
    });
    
    // 4. Recepción de pausa de chat
    socket.on("chatPaused", (data) => {
        if (data.sender === partnerName) {
            updatePartnerStatusDisplay(partnerMood, 'paused');
            alert(`El chat fue pausado por ${partnerName} por ${data.duration} minutos.`);
        }
    });
    
    // 5. Recepción de nuevo mensaje
    socket.on("newMessage", (data) => {
        if (data.sender !== partnerName) return; 
        
        const todayKey = formatDateKey();
        if (!chats[todayKey]) {
            chats[todayKey] = [];
        }
        
        // Agregar mensaje (marcado como NO leído)
        chats[todayKey].push({ ...data.message, sender: data.sender, read: false }); 
        saveData();
        
        // Actualizar la lista para mostrar el nuevo mensaje y el badge de no leídos
        renderChatList();
        
        // (Opcional) Puedes añadir una vibración o sonido aquí.
    });
    
    // -------------------
    // D. INICIALIZACIÓN
    // -------------------

    // 1. Asegurarse de que el chat de hoy exista 
    const todayKey = formatDateKey();
    if (!chats[todayKey]) {
        chats[todayKey] = [];
        saveData();
    }
    
    // 2. Renderizar la lista de chats y el modal de estados de ánimo
    renderChatList(); 
    renderMoods();
    updateMyMoodButton(myMood); // Sincroniza el botón inicial
    
    // 3. Inicializar el estado de la pareja al cargar la página
    if (sessionStorage.getItem("partnerStatus")) {
        // Usar el último estado conocido si existe
        updatePartnerStatusDisplay(partnerMood, sessionStorage.getItem("partnerStatus"));
    } else {
        // Se solicitará en 'connect'
    }

})();