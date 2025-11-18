// =======================================================
// menu.js
// Lógica para la PÁGINA PRINCIPAL / LISTA DE CHATS
// =======================================================

(function () {
    // -------------------\
    // VARIABLES Y UTILIDADES
    // -------------------
    const currentUser = sessionStorage.getItem("currentUser");
    const partnerName = currentUser === 'Leo' ? 'Estefi' : 'Leo';
    let chats = JSON.parse(localStorage.getItem(`chats_${currentUser}`)) || {};
    let myMood = sessionStorage.getItem("myMood") || "😴";
    let partnerMood = sessionStorage.getItem("partnerMood") || "?";
    let partnerStatus = 'offline'; // 'online', 'paused', 'offline'
    
    // Variables para Socket.IO (Se asume que la librería está cargada)
    const socket = io();

    const MOODS = {
        '😍': { text: 'Enamorado', class: 'mood-enamorado' },
        '😊': { text: 'Feliz', class: 'mood-happy' },
        '😴': { text: 'Cansado/a', class: 'mood-cansado' },
        '😡': { text: 'Enojado/a', class: 'mood-enojado' },
        '😔': { text: 'Triste', class: 'mood-triste' },
        '😫': { text: 'Estresado/a', class: 'mood-estresado' },
        '💬': { text: 'Quiero Hablar', class: 'mood-porhablar' },
        '?': { text: 'Desconocido', class: 'mood-default' },
    };

    const getPartnerName = () => partnerName;
    const formatDateKey = (date = new Date()) => date.toISOString().split('T')[0]; // YYYY-MM-DD
    const saveData = () => localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));


    // -------------------\
    // MANEJADORES DE ESTADO (VISTAS)
    // -------------------

    const updatePartnerStatusDisplay = (mood, status) => {
        // ✅ Esta línea YA actualiza la variable global partnerStatus, ¡es correcto!
        partnerStatus = status; 
        const moodInfo = MOODS[mood] || MOODS['?'];
        const moodDisplay = document.getElementById('partnerMoodDisplay');
        const moodText = document.getElementById('partnerStatusText');
        const emojiSpan = document.getElementById('partnerMoodEmoji');

        if (!moodDisplay || !moodText || !emojiSpan) return;

        // Limpia las clases de ánimo anteriores
        Object.values(MOODS).forEach(m => {
            moodDisplay.classList.remove(m.class);
        });

        // Aplica el nuevo ánimo y el emoji
        moodDisplay.classList.add(moodInfo.class);
        emojiSpan.textContent = mood;

        let statusText = status === 'online' ? 'En línea' : status === 'paused' ? 'Pausado' : 'Desconectado';
        
        moodText.textContent = `${getPartnerName()} | ${statusText} (${moodInfo.text})`;
    };
    
    const updateMyMoodButton = (mood) => {
        const btn = document.getElementById('openMoodModal');
        if (btn) btn.textContent = mood;
    };
    
    // -------------------\
    // RENDERIZADO DE CHAT
    // -------------------

    const renderChatList = () => {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        // Obtener las claves (fechas) y ordenarlas de más reciente a más antigua
        const chatKeys = Object.keys(chats).sort((a, b) => new Date(b) - new Date(a));

        chatList.innerHTML = '';

        chatKeys.forEach(key => {
            const chatArray = chats[key];
            const lastMessage = chatArray.length > 0 ? chatArray[chatArray.length - 1] : { text: "Comenzá la conversación...", date: "" };
            const unreadCount = chatArray.filter(msg => msg.receiver === currentUser && !msg.read).length;
            const unreadClass = unreadCount > 0 ? 'unread' : '';
            const displayDate = key.split('-').reverse().slice(0, 2).join('/'); // Ej: 18/11

            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${unreadClass}`;
            chatItem.dataset.chatDate = key;

            chatItem.innerHTML = `
                <div class="avatar">${getPartnerName()[0]}</div>
                <div class="meta">
                    <div class="chat-name">${getPartnerName()}</div>
                    <div class="chat-last">${lastMessage.text}</div>
                </div>
                <div class="meta-right">
                    <div class="chat-date">${displayDate}</div>
                    ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                </div>
            `;
            chatList.appendChild(chatItem);
        });

        // Agregar manejador de click para navegar al chat.
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            item.addEventListener('click', () => {
                const chatKey = item.dataset.chatDate;
                sessionStorage.setItem('currentChatKey', chatKey);
                window.location.href = 'chat.html'; 
            });
        });
    };

    // -------------------\
    // MODALES Y EVENTOS
    // -------------------

    const toggleModal = (modalId, show) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.toggle('active', show);
        }
    };

    const renderMoods = () => {
        const moodList = document.getElementById('moodList');
        if (!moodList) return;
        
        moodList.innerHTML = Object.keys(MOODS).map(emoji => {
            if (emoji === '?') return ''; // Omitir el estado desconocido
            const { text, class: moodClass } = MOODS[emoji];
            const isSelected = emoji === myMood;
            return `
                <button 
                    class="mood-btn ${moodClass} ${isSelected ? 'selected' : ''}" 
                    data-mood-emoji="${emoji}"
                    data-mood-text="${text}"
                >${emoji}</button>
            `;
        }).join('');
        
        // Asignar el listener después de renderizar
        moodList.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newMood = btn.dataset.moodEmoji;
                myMood = newMood;
                sessionStorage.setItem("myMood", myMood);
                
                updateMyMoodButton(myMood);
                renderMoods(); // Re-renderizar para actualizar el estado seleccionado
                toggleModal('moodsContainer', false);

                // 🌐 Emitir evento de cambio de ánimo al servidor
                socket.emit('moodChanged', { sender: currentUser, mood: myMood });
            });
        });
    };

    const renderPauseButtons = () => {
        // Renderizado de botones de pausa (Lógica de ejemplo)
        // ... (Tu implementación para renderizar botones de pausa aquí) ...
    };

    // Asignación de listeners a botones de modales
    document.getElementById('openMoodModal').addEventListener('click', () => {
        renderMoods();
        toggleModal('moodsContainer', true);
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.modalTarget || e.currentTarget.closest('.modal-backdrop').id;
            toggleModal(target, false);
        });
    });


    // -------------------\
    // SOCKET.IO LISTENERS
    // -------------------

    socket.on("connect", () => {
        // Enviar la información de conexión
        socket.emit('userConnected', { user: currentUser, mood: myMood });
        // Pedir el estado real de la pareja después de la conexión
        socket.emit('requestPartnerStatus', { targetUser: getPartnerName() });
    });

    socket.on("partnerStatus", (data) => {
        // Recibe el estado inicial al conectarse
        if (data.user === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood);
            updatePartnerStatusDisplay(data.mood, data.status);
        }
    });
    
    socket.on("moodChanged", (data) => { 
        if (data.sender === getPartnerName()) {
            sessionStorage.setItem("partnerMood", data.mood); 
            // Usar partnerStatus que DEBE estar actualizado por statusChanged o partnerStatus
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
        }
    });


    // =======================================================
    // INICIALIZACIÓN DE menu.html
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
    
    // 4. ✅ ESTE BLOQUE REDUNDANTE FUE ELIMINADO.
    // La lógica de conexión se maneja solo en socket.on("connect", ...)
    // lo que asegura que userConnected y requestPartnerStatus se envíen
    // correctamente al servidor.
    

})();