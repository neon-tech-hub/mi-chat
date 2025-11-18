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
    let partnerStatus = 'offline'; 

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
    const saveData = () => localStorage.setItem(`chats_${currentUser}`, JSON.stringify(chats));
    
    // Configuración de Socket.IO
    const socket = (typeof io !== 'undefined') ? io() : { on: () => {}, emit: () => {} };

    // --- Funciones de Renderizado ---

    function renderChatList() {
        const chatListDiv = document.getElementById('chatList');
        if (!chatListDiv) return;
        
        chatListDiv.innerHTML = '';
        
        const sortedKeys = Object.keys(chats).sort().reverse();

        sortedKeys.forEach(key => {
            const chat = chats[key];
            if (!chat || chat.length === 0) return;

            const lastMessage = chat[chat.length - 1];
            const unreadCount = chat.filter(msg => msg.sender !== currentUser && !msg.read).length;

            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${unreadCount > 0 ? 'unread' : ''}`;
            chatItem.dataset.chatKey = key;
            
            // 🟢 MODIFICACIÓN CLAVE: Redirige a chat.html con la clave de chat
            chatItem.onclick = () => {
                window.location.href = `chat.html?chatKey=${key}`;
            };

            let lastText = lastMessage.text;
            
            if (lastMessage.replyToText) {
                lastText = `↩️ Respondió: ${lastMessage.text}`;
            } else if (lastMessage.important) {
                lastText = `🌟 Importante: ${lastMessage.text}`;
            } else if (lastMessage.sender === currentUser) {
                lastText = `Tú: ${lastText}`;
            }

            const date = new Date(lastMessage.timestamp);
            const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

            chatItem.innerHTML = `
                <div class="avatar">${key.substring(8, 10)}/${key.substring(5, 7)}</div>
                <div class="meta">
                    <span class="chat-name">${key}</span>
                    <span class="chat-last">${lastText}</span>
                </div>
                <span class="chat-date">${dateStr}</span>
                ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
            `;
            chatListDiv.appendChild(chatItem);
        });
    }

    function updatePartnerStatusDisplay(moodEmoji, status) {
        partnerMood = moodEmoji;
        partnerStatus = status;
        
        const emojiCircle = document.getElementById('partnerMood');
        const statusHeader = document.getElementById('statusHeader');
        
        if (emojiCircle) {
            const moodData = MOODS[moodEmoji] || { text: 'Ausente', class: 'mood-default' };
            emojiCircle.textContent = moodEmoji;
            
            // Remover y añadir clases de mood y estado
            Object.values(MOODS).forEach(m => emojiCircle.classList.remove(m.class));
            // También remueve clases de estado que ya se deberían manejar con data-status
            emojiCircle.classList.remove('mood-default'); 
            emojiCircle.classList.add(moodData.class);
            
            // Actualizar data-status en el contenedor padre
            const statusDisplay = document.querySelector('.partner-status-display');
            if (statusDisplay) {
                statusDisplay.dataset.status = status;
            }
        }

        // Actualizar texto de estado
        if (statusHeader) {
            let statusText = status === 'online' ? 'Disponible' : (status === 'paused' ? 'Pausado' : 'Ausente');
            const moodText = (MOODS[moodEmoji] && moodEmoji !== '?') ? `(${MOODS[moodEmoji].text})` : '';
            statusHeader.textContent = `${getPartnerName()} | ${statusText} ${moodText}`;
        }
    }

    function renderMoods() {
        const moodList = document.getElementById('moodList');
        if (!moodList) return;

        moodList.innerHTML = '';
        Object.keys(MOODS).forEach(emoji => {
            const button = document.createElement('button');
            button.className = `mood-btn ${emoji === myMood ? 'selected' : ''}`;
            button.textContent = emoji;
            button.dataset.mood = emoji;
            button.onclick = () => selectMood(emoji);
            moodList.appendChild(button);
        });
    }
    
    function updateMyMoodButton(emoji) {
        myMood = emoji;
        sessionStorage.setItem("myMood", emoji);
        const myMoodBtn = document.getElementById('openMoodModal');
        if (myMoodBtn) {
            myMoodBtn.textContent = emoji;
        }
        // Notificar al servidor mi mood
        socket.emit('moodChanged', { sender: currentUser, mood: emoji });
    }

    // --- Lógica de Modales y Acciones ---

    function openModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    }

    function closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }

    function selectMood(emoji) {
        myMood = emoji;
        updateMyMoodButton(emoji);
        renderMoods(); 
        closeModal('moodsContainer');
    }
    
    function renderPauseButtons() {
        const buttonsContainer = document.getElementById('pauseTimeButtons');
        if (!buttonsContainer) return;

        buttonsContainer.innerHTML = '';
        const pauseTimes = [5, 15, 30, 60]; // Minutos

        pauseTimes.forEach(time => {
            const button = document.createElement('button');
            button.className = 'mood-btn';
            button.textContent = `${time} Min`;
            button.onclick = () => pauseChat(time);
            buttonsContainer.appendChild(button);
        });
    }
    
    function pauseChat(minutes) {
        const now = Date.now();
        const lastPause = parseInt(sessionStorage.getItem('lastPauseTime') || '0', 10);
        
        if (now - lastPause < 3600000) { // 1 hora
            alert('Solo puedes pausar el chat una vez por hora.');
            closeModal('pauseTimeModal');
            return;
        }

        sessionStorage.setItem('lastPauseTime', now);
        
        socket.emit('chatPaused', { sender: currentUser, duration: minutes });
        
        updatePartnerStatusDisplay(partnerMood, 'paused');
        
        closeModal('pauseTimeModal');
    }


    // --- Configuración de Eventos ---

    document.getElementById('openMoodModal')?.addEventListener('click', () => openModal('moodsContainer'));
    document.getElementById('openPauseTimeModal')?.addEventListener('click', () => openModal('pauseTimeModal')); // 👈 CORRECCIÓN: ID del botón de pausa
    // 🔴 LÓGICA DE REDIRECCIÓN A CHAT DE HOY
    document.getElementById('addChatBtn')?.addEventListener('click', () => { 
        const todayKey = formatDateKey();
        window.location.href = `chat.html?chatKey=${todayKey}`;
    });

    // Eventos para cerrar modales (delegación)
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                closeModal(modal.id);
            }
        });
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.modalTarget || e.currentTarget.closest('.modal-backdrop')?.id;
            if (targetId) {
                closeModal(targetId);
            }
        });
    });

    // --- Lógica de Socket.IO ---

    socket.on("receiveMessage", (data) => { 
        if (data.recipient === currentUser) {
            const { chatKey, message } = data;
            if (!chats[chatKey]) chats[chatKey] = [];
            chats[chatKey].push(message);
            saveData();
            // Solo actualiza la lista, no renderiza mensajes
            renderChatList(); 
        }
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
    
    // 3. Inicializar el estado de la pareja
    partnerMood = sessionStorage.getItem("partnerMood") || "?";
    updatePartnerStatusDisplay(partnerMood, 'offline'); 
    
    // 4. Pedir al servidor el estado de ánimo y conexión real de la pareja
    socket.emit('requestPartnerStatus'); 
    
})();