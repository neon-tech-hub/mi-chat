(() => {
    "use strict";

    const socket = io();
    const currentUser = sessionStorage.getItem("currentUser");
    
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // CRUCIAL: Notificar al servidor quién eres para el manejo de estados de conexión (online/offline)
    socket.emit('registerUser', currentUser); 

    // --- Variables de Estado y Control ---
    const AVAILABLE_MOODS = ["❤️", "😊", "😴", "😢", "😠", "😅", "✨", "⏳"];
    
    // 🔴 NUEVO: Opciones de pausa predefinidas en minutos
    const PAUSE_OPTIONS = [2, 5, 8, 10, 12, 15]; 
    const PAUSE_COOLDOWN = 60 * 60 * 1000; // 1 hora en milisegundos

    // Control de la última pausa (para la restricción de 1 vez por hora)
    let lastPauseTime = localStorage.getItem("lastPauseTime") ? parseInt(localStorage.getItem("lastPauseTime")) : 0;
    
    // 🔴 NUEVO: Variables para la funcionalidad de Responder
    let messageToReplyId = null; 
    let messageToReplyText = null; 

    // Mapeo de Emojis a Nombres en español
    const MOOD_NAMES = {
        "❤️": "enamorado",
        "😊": "feliz",
        "😴": "cansado",
        "😢": "triste",
        "😠": "enojado",
        "😅": "ansioso",
        "✨": "inspirado",
        "⏳": "ocupado",
        "?": "indefinido" 
    };

    const PROHIBITED_WORDS = [
        "tonto", "estúpido", "idiota", "imbécil", "boludo", "pelotudo", 
        "tarado", "mierda", "puto", "gil", "cabrón", "zorra", "pendejo",
        "carajo", "caca", "vaca", "bruto", "imbecil" 
    ];
    let chats = {};
    let currentChat = null;
    
    // Almacenamiento del estado de la pareja
    let partnerMood = sessionStorage.getItem("partnerMood") || "?"; 
    
    // Referencias al DOM
    const chatListDiv = document.getElementById("chatList");
    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");
    const chatPartner = document.getElementById("chatPartner"); 
    const partnerStatus = document.getElementById("partnerStatus"); 
    // Referencia al estado emocional en texto
    const partnerMoodText = document.getElementById("partnerMoodText"); 
    const messagesContainer = document.getElementById("messages");
    const messageInput = document.getElementById("messageInput");
    
    // NUEVAS REFERENCIAS para el diseño actualizado
    const sendBtnIcon = document.getElementById("sendBtnIcon"); 
    const pauseChatBtn = document.getElementById("pauseChatBtn"); 
    const backBtn = document.getElementById("backBtn");
    
    // Elementos del estado emocional
    const emojiCircle = document.getElementById("emojiCircle"); 
    const openStateModal = document.getElementById("openStateModal"); 
    const moodsContainer = document.getElementById("moodsContainer");
    const moodList = document.getElementById("moodList");

    // 🔴 NUEVAS REFERENCIAS para Modales de Interacción y Pausa
    const pauseTimeModal = document.getElementById("pauseTimeModal");
    const pauseTimeButtons = document.getElementById("pauseTimeButtons");
    const messageActionsModal = document.getElementById("messageActionsModal");
    const selectedMessageText = document.getElementById("selectedMessageText");
    const replyMessageBtn = document.getElementById("replyMessageBtn");
    const markImportantBtn = document.getElementById("markImportantBtn");
    
    // --- Funciones de Utilidad y Almacenamiento ---

    function saveData() { localStorage.setItem("chatData", JSON.stringify({ chats })); }
    
    function loadData() {
        try {
            const saved = localStorage.getItem("chatData");
            if (saved) {
                const data = JSON.parse(saved);
                chats = data.chats || {};
            }
        } catch (e) {
            console.warn("Error cargando chats:", e);
        }
    }
    loadData();

    function formatDateKey(date = new Date()) {
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        return `${d}-${m}`;
    }

    // Verifica si el texto contiene palabras prohibidas
    function containsInsult(text) {
        const lowerCaseText = text.toLowerCase();
        
        const foundInsult = PROHIBITED_WORDS.some(word => lowerCaseText.includes(word));
        
        return foundInsult;
    }

    // FUNCIÓN CRUCIAL: Gestiona el estado de Conexión y Emocional
    function updatePartnerStatusDisplay(moodEmoji, currentStatus) {
        const isOnline = currentStatus === 'online'; 
        
        // 1. Estado de Conexión (partnerStatus): Siempre muestra Activo/Ausente.
        partnerStatus.textContent = isOnline ? 'Activo' : 'Ausente';
        
        // 2. Lógica del Estado Emocional (partnerMoodText y emojiCircle)
        if (moodEmoji && moodEmoji !== "?" && MOOD_NAMES[moodEmoji]) {
            // Caso A: Hay un estado de ánimo seleccionado.
            
            // a) Círculo (Pantalla Principal): Debe mostrar el EMOJI.
            emojiCircle.textContent = moodEmoji; 

            // b) Texto en Chat (partnerMoodText):
            if (isOnline) {
                // Si está ACTIVO, muestra el estado emocional al lado: "Activo — enojado"
                partnerMoodText.textContent = `— ${MOOD_NAMES[moodEmoji]}`; 
            } else {
                // Si está AUSENTE, no debe aparecer nada al lado.
                partnerMoodText.textContent = '';
            }

        } else {
            // Caso B: NO hay estado de ánimo seleccionado ('?').
            
            // a) Círculo (Pantalla Principal): Muestra el emoji por defecto (❓ o 😴)
            const defaultEmoji = isOnline ? '❓' : '😴';
            emojiCircle.textContent = defaultEmoji;

            // b) Texto en Chat (partnerMoodText): No debe aparecer nada.
            partnerMoodText.textContent = '';
        }
    }

    // 🔴 NUEVA Lógica de Pausa con Lista de Opciones (Reemplaza tryPauseChat)
    
    function openPauseModal() {
        const now = new Date().getTime();

        if (now - lastPauseTime < PAUSE_COOLDOWN) {
            const remainingTimeSeconds = Math.ceil((PAUSE_COOLDOWN - (now - lastPauseTime)) / 1000);
            const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
            alert(`❌ Debes esperar ${remainingMinutes} minutos más para volver a pausar el chat (1 pausa por hora).`);
            return;
        }

        // Generar botones de tiempo dinámicamente
        pauseTimeButtons.innerHTML = PAUSE_OPTIONS.map(min => 
            `<button class="btn primary small pause-option" data-minutes="${min}">${min} min</button>`
        ).join('');

        pauseTimeModal.style.display = 'flex';
    }

    function applyPause(durationMinutes) {
        // 1. Aplicar la pausa (deshabilitar entrada de texto y botones)
        messageInput.disabled = true;
        sendBtnIcon.disabled = true;
        pauseChatBtn.disabled = true;
        messageInput.placeholder = `Chat pausado por ${durationMinutes} minutos...`;
        
        // 2. Iniciar el temporizador para reactivar
        setTimeout(() => {
            messageInput.disabled = false;
            sendBtnIcon.disabled = false;
            pauseChatBtn.disabled = false;
            messageInput.placeholder = "Escribe tu mensaje...";
            alert("✅ La pausa del chat ha terminado.");
        }, durationMinutes * 60 * 1000);

        // 3. Registrar el tiempo de enfriamiento (cooldown)
        lastPauseTime = new Date().getTime();
        localStorage.setItem("lastPauseTime", lastPauseTime);
        
        alert(`⏳ Chat pausado exitosamente por ${durationMinutes} minutos. ¡Desconectá un rato!`);
        pauseTimeModal.style.display = 'none';
    }


    // 🔴 NUEVA FUNCIÓN: Actualiza el estado 'leído' del mensaje y notifica al servidor
    function updateMessageReadStatus(messageId) {
        if (!currentChat) return;
        
        // Encuentra el chat y el mensaje
        const chat = chats[currentChat];
        const msg = chat.find(m => m.id === messageId);

        // Solo marcamos como leído si el mensaje fue recibido y aún no está marcado
        if (msg && msg.sender !== currentUser && !msg.read) {
            msg.read = true;
            saveData();
            // Notificar al servidor que el mensaje fue leído
            socket.emit("messageRead", { chatId: currentChat, messageId: messageId });
        }
    }

    // --- Lógica de Renderizado y Flujo (Resto de funciones) ---

    function renderChatList() {
        chatListDiv.innerHTML = ""; 

        // 1. DIBUJAR el botón para crear un nuevo chat (siempre)
        const addBtn = document.createElement("button");
        addBtn.className = "add-chat";
        addBtn.title = "Nuevo chat (hoy)";
        addBtn.innerText = "+";
        chatListDiv.appendChild(addBtn);

        // Obtener y ordenar las claves de chat
        const days = Object.keys(chats).sort((a, b) => {
            const currentYear = new Date().getFullYear(); 
            const A_parts = a.split("-");
            const B_parts = b.split("-");
            
            // Nota: Aquí se asume el año actual para ordenar.
            const dateA = new Date(`${currentYear}-${A_parts[1]}-${A_parts[0]}`);
            const dateB = new Date(`${currentYear}-${B_parts[1]}-${B_parts[0]}`);
            
            return dateB - dateA; 
        });

        // 2. Renderizar los chats existentes
        if (days.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chat-item empty-message";
            empty.innerHTML = `
                <div class="avatar"></div>
                <div class="meta">
                <div class="chat-name">Sin chats</div>
                <div class="chat-last">Presioná '+' para iniciar</div>
                </div>
            `;
            chatListDiv.appendChild(empty);
        } else {
            days.forEach(day => {
                const btn = document.createElement("button");
                btn.className = "chat-item";
                const lastMsg = (chats[day] && chats[day].length)
                    ? chats[day][chats[day].length - 1].text
                    : "Toca para empezar a hablar";
                
                btn.innerHTML = `
                    <div class="avatar"></div>
                    <div class="meta">
                        <div class="chat-name">Chat ${day}</div>
                        <div class="chat-last">${lastMsg}</div>
                    </div>
                `;
                btn.onclick = () => tryOpenChat(day);
                chatListDiv.appendChild(btn);
            });
        }
    }

    // Función: Verifica si el usuario puede entrar al chat (Restricción de Estado)
    function tryOpenChat(day) {
        const myCurrentMood = sessionStorage.getItem("myMood");
        
        if (!myCurrentMood || myCurrentMood === "?") {
            alert("⚠️ ¡Debes seleccionar tu estado emocional antes de entrar a un chat!");
            openStateModal.click(); 
            return;
        }
        
        openChat(day);
    }
    
    function openChat(day) {
        currentChat = day;
        mainScreen.classList.remove("active");
        chatScreen.classList.add("active");

        chatPartner.textContent = currentUser === "Leo" ? "Estefi" : "Leo";
        renderMessages();
    }
    
    // 🔴 Modificación de renderMessages para las nuevas funcionalidades
    function renderMessages() { 
        messagesContainer.innerHTML = "";
        if (!currentChat || !chats[currentChat]) return;

        let lastSentMessage = null; // Para rastrear el último mensaje que envié
        
        chats[currentChat].forEach(msg => {
            const div = document.createElement("div");
            div.className = msg.sender === currentUser ? "message sent" : "message received";
            div.dataset.messageId = msg.id; // CRUCIAL para responder/marcar
            
            // 🟢 Resaltado para MENSAJE IMPORTANTE (Si lo marcó el emisor)
            if (msg.isImportant) {
                div.classList.add('important-message');
            }

            // 🟢 Bloque de RESPUESTA (si existe replyToText)
            if (msg.replyToText) {
                const replyBlock = document.createElement('div');
                replyBlock.className = 'reply-block';
                // Mostramos el remitente original (Tú o el nombre)
                const originalSenderName = msg.replyToId.endsWith(currentUser) ? 'Tú' : (currentUser === "Leo" ? "Estefi" : "Leo");
                replyBlock.innerHTML = `
                    <strong>${originalSenderName}:</strong> ${msg.replyToText}
                `;
                div.appendChild(replyBlock);
            }

            const msgText = document.createElement('p');
            msgText.textContent = msg.text;
            div.appendChild(msgText);

            const ts = document.createElement("span");
            ts.className = "ts";
            const d = new Date(msg.time);
            ts.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            div.appendChild(ts);

            // 🟢 Para la confirmación de lectura y rastreo
            if (msg.sender === currentUser) {
                lastSentMessage = msg;
                // Añadir el status de "Leído" si ya lo está (en el envío)
                if (msg.read) {
                    const readStatus = document.createElement('span');
                    readStatus.className = 'read-status';
                    readStatus.textContent = 'Leído';
                    ts.after(readStatus);
                }
            } else {
                // Marcar como leído si lo estoy viendo
                updateMessageReadStatus(msg.id);
            }

            messagesContainer.appendChild(div);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Añade un mensaje al historial y lo renderiza
    function addMessage(msgData) { 
        const dayKey = formatDateKey(new Date(msgData.time));
        if (!chats[dayKey]) chats[dayKey] = [];
        chats[dayKey].push(msgData);
        saveData();

        if (dayKey === currentChat) {
            renderMessages();
        }
        renderChatList();
    }
    
    function renderMoods() {
        moodList.innerHTML = "";
        AVAILABLE_MOODS.forEach(mood => {
            const btn = document.createElement("button");
            btn.className = "mood-btn";
            btn.textContent = mood;
            btn.dataset.mood = mood;
            moodList.appendChild(btn);
        });
    }

    // 🔴 Modificación de sendMessage para incluir ID y datos de respuesta/importante
    const sendMessage = () => { 
        if (!currentChat) {
            alert("Seleccioná un chat primero.");
            return;
        }

        const text = messageInput.value.trim();
        if (!text) return;

        // DETECCIÓN DE INSULTOS
        if (containsInsult(text)) {
            alert("🚫 ¡Atención! Tu mensaje no debe contener insultos o palabras ofensivas. Por favor, revisá tu redacción.");
            return; // Bloquea el envío si hay insulto
        }
        
        // Si no hay insultos, procede directamente al envío
        const msgData = {
            id: new Date().getTime().toString(), // 🔴 ID único CRUCIAL
            sender: currentUser,
            text,
            time: new Date().toISOString(),
            read: false, // 🔴 Nuevo campo
            replyToId: messageToReplyId, // 🔴 Nuevo campo
            replyToText: messageToReplyText, // 🔴 Nuevo campo
            isImportant: false // 🔴 Nuevo campo
        };

        // Emitir el mensaje al servidor
        socket.emit("sendMessage", msgData);

        // Añadir el mensaje localmente
        addMessage(msgData);

        messageInput.value = "";

        // 🔴 Restablecer el estado de respuesta
        messageToReplyId = null;
        messageToReplyText = null;
        messageInput.placeholder = "Escribe tu mensaje..."; 
    };

    // --- Lógica de Event Listeners ---

    // Lógica para ABRIR el selector de estados
    openStateModal.addEventListener("click", () => {
        moodsContainer.classList.add("active"); 
    });

    // Lógica para SELECCIONAR y EMITIR el estado
    moodList.addEventListener("click", (e) => {
        const selectedMood = e.target.dataset.mood;
        if (!selectedMood) return;

        const moodData = {
            sender: currentUser,
            mood: selectedMood
        };

        // 1. Guardar mi estado emocional localmente para la restricción 
        sessionStorage.setItem("myMood", selectedMood);

        // 2. Emitir el estado al servidor
        socket.emit("updateMood", moodData);

        // 3. Ocultar el selector de estados
        moodsContainer.classList.remove("active");
    });
    
    // Conexión del botón de enviar
    sendBtnIcon.addEventListener("click", sendMessage);
    
    // 🔴 Conexión del botón de pausa al nuevo modal
    pauseChatBtn.addEventListener("click", openPauseModal);

    // 🔴 Listener para la selección de tiempo en el modal de pausa
    pauseTimeButtons.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains('pause-option')) {
            const duration = parseInt(target.dataset.minutes);
            if (!isNaN(duration)) {
                applyPause(duration);
            }
        }
    });

    // 🔴 Listener para cerrar los modales
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    chatListDiv.addEventListener("click", e => {
        if (e.target.classList.contains("add-chat")) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            tryOpenChat(key); 
        }
    });
    
    // 🔴 NUEVA LÓGICA: Alerta si intenta salir sin responder un mensaje importante
    backBtn.addEventListener("click", () => {
        // 1. Ocultar la pantalla de chat si no hay chat activo
        if (!currentChat) {
            chatScreen.classList.remove("active");
            mainScreen.classList.add("active");
            return;
        }

        // 2. Buscar el último mensaje *marcado como importante* que el currentUser *recibió*
        // Se busca en orden inverso para encontrar el más reciente.
        const importantReceivedMessage = chats[currentChat].slice().reverse().find(
            msg => msg.isImportant && msg.sender !== currentUser
        );

        if (importantReceivedMessage) {
            // 3. Comprobar si ya existe una respuesta directa a ese mensaje
            const hasReplied = chats[currentChat].some(
                msg => msg.sender === currentUser && msg.replyToId === importantReceivedMessage.id
            );

            if (!hasReplied) {
                // 4. Mostrar la alerta de confirmación si NO ha respondido
                const confirmation = confirm(
                    `⚠️ ¡Alerta de Pareja! ⚠️\n\nTu pareja marcó el mensaje: "${importantReceivedMessage.text.substring(0, 50)}..." como importante.\n\n¿Seguro que querés salir sin responder?`
                );

                if (!confirmation) {
                    // Si el usuario cancela, se queda en el chat
                    return;
                }
            }
        }

        // 5. Si no hay mensaje importante, ya se respondió, o el usuario confirmó la salida, salir
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
    });

    // 🔴 NUEVO: Lógica para abrir el menú de acciones al hacer clic en un mensaje
    messagesContainer.addEventListener('click', (e) => {
        let target = e.target.closest('.message');
        if (!target) return;

        const messageId = target.dataset.messageId;
        
        // Obtener el objeto mensaje real
        const msg = chats[currentChat].find(m => m.id === messageId);
        if (!msg) return;

        // Configurar la ventana modal
        messageActionsModal.style.display = 'flex';
        messageActionsModal.dataset.messageId = messageId;
        selectedMessageText.textContent = msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : '');

        // Deshabilitar "Marcar Importante" si ya lo está O si es un mensaje que recibí (solo puedo marcar los que envié)
        markImportantBtn.disabled = msg.isImportant || msg.sender !== currentUser;
        
        // El botón Responder siempre está disponible
    });

    // 🔴 NUEVO: Listener para el botón RESPONDER
    replyMessageBtn.addEventListener('click', () => {
        const messageId = messageActionsModal.dataset.messageId;
        const msg = chats[currentChat].find(m => m.id === messageId);

        if (msg) {
            // Almacenar el ID y Texto para el próximo envío
            messageToReplyId = messageId;
            messageToReplyText = msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''); 

            // Indicar al usuario que está respondiendo y cerrar modal
            messageInput.placeholder = `Respondiendo a: "${messageToReplyText}"`;
            messageInput.focus();
            messageActionsModal.style.display = 'none';
        }
    });

    // 🔴 NUEVO: Listener para el botón MARCAR IMPORTANTE
    markImportantBtn.addEventListener('click', () => {
        const messageId = messageActionsModal.dataset.messageId;
        const msgIndex = chats[currentChat].findIndex(m => m.id === messageId);

        if (msgIndex !== -1) {
            // Marcar localmente
            chats[currentChat][msgIndex].isImportant = true;
            saveData();
            renderMessages(); // Actualizar la visualización para el resaltado

            // Notificar al servidor (y al otro usuario)
            socket.emit("markImportant", { chatId: currentChat, messageId: messageId });

            messageActionsModal.style.display = 'none';
            alert("🌟 Mensaje marcado como importante. ¡Tu pareja recibirá una alerta si intenta salir sin responder!");
        }
    });

    // --- Lógica de Recepción (Socket.io) ---

    // Lógica de RECEPCIÓN (Mensajes)
    socket.on("receiveMessage", (msgData) => { 
        if (msgData.sender !== currentUser) {
            addMessage(msgData);
        }
    });
    
    // 🔴 NUEVO: Lógica de RECEPCIÓN de estado de lectura (read) y marcado (important)
    socket.on("messageStatusUpdate", (data) => {
        const dayKey = data.chatId;
        if (chats[dayKey]) {
            const msg = chats[dayKey].find(m => m.id === data.messageId);
            if (msg) {
                if (data.status === 'read' && data.sender !== currentUser) {
                    // Actualización de estado de lectura (recibido por el remitente original)
                    msg.read = true;
                } else if (data.status === 'important' && data.sender !== currentUser) {
                    // Actualización de estado importante (recibido por el destinatario)
                    msg.isImportant = true;
                }

                saveData();
                if (dayKey === currentChat) {
                    renderMessages();
                }
            }
        }
    });
    
    // Lógica de RECEPCIÓN DE ESTADOS EMOCIONALES
    socket.on("moodChanged", (data) => {
        if (data.sender !== currentUser) {
            const moodEmoji = data.mood;

            // 1. Guardar el estado para persistencia
            sessionStorage.setItem("partnerMood", moodEmoji); 
            partnerMood = moodEmoji;

            // 2. ACTUALIZAR la visualización completa (asumimos 'online' al cambiar el mood)
            updatePartnerStatusDisplay(moodEmoji, 'online'); 
        }
    });

    // Lógica de RECEPCIÓN DE ESTADO DE CONEXIÓN
    socket.on("statusChanged", (data) => { 
        if (data.sender !== currentUser && partnerStatus) {
            // data.status es 'online' o 'offline'
            const currentPartnerMood = sessionStorage.getItem("partnerMood") || "?";
            
            // 1. Llamar a la función de display con el estado de ánimo guardado y el estado de conexión recién recibido.
            updatePartnerStatusDisplay(currentPartnerMood, data.status);
        }
    });

    // --- Inicialización (Orden Corregido) ---

    // 1. Asegurarse de que el chat de hoy exista (primero)
    const todayKey = formatDateKey();
    if (!chats[todayKey]) {
        chats[todayKey] = [];
        saveData();
    }

    // 2. Cargar el estado de la pareja si existe (PERSISTENCIA)
    const initialPartnerMood = sessionStorage.getItem("partnerMood");
    
    // Al iniciar, asumimos que la pareja está 'offline'/'Ausente' hasta que el socket nos indique lo contrario.
    updatePartnerStatusDisplay(initialPartnerMood, 'offline'); 

    // 3. Mostrar la pantalla principal y renderizar todo (ahora chats ya tiene el chat de hoy)
    mainScreen.classList.add("active"); 
    renderChatList(); 
    renderMoods(); 
})();