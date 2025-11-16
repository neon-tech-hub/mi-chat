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
    const PAUSE_COOLDOWN = 60 * 60 * 1000; // 1 hora en milisegundos

    // Control de la última pausa (para la restricción de 1 vez por hora)
    let lastPauseTime = localStorage.getItem("lastPauseTime") ? parseInt(localStorage.getItem("lastPauseTime")) : 0;
    
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
    
    // ⚠️ NUEVAS REFERENCIAS para el diseño actualizado
    const sendBtnIcon = document.getElementById("sendBtnIcon"); 
    const pauseChatBtn = document.getElementById("pauseChatBtn"); 

    const backBtn = document.getElementById("backBtn");
    
    // Elementos del estado emocional
    const emojiCircle = document.getElementById("emojiCircle"); 
    const openStateModal = document.getElementById("openStateModal"); 
    const moodsContainer = document.getElementById("moodsContainer");
    const moodList = document.getElementById("moodList");

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

    // FUNCIÓN CRUCIAL: Gestiona el estado de Conexión (partnerStatus) y Emocional (partnerMoodText y emojiCircle)
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

    // --- Lógica de Pausa (Nueva Funcionalidad) ---
    
    function tryPauseChat() {
        const now = new Date().getTime();

        if (now - lastPauseTime < PAUSE_COOLDOWN) {
            const remainingTimeSeconds = Math.ceil((PAUSE_COOLDOWN - (now - lastPauseTime)) / 1000);
            const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
            alert(`❌ Debes esperar ${remainingMinutes} minutos más para volver a pausar el chat (1 pausa por hora).`);
            return;
        }

        // Pedir al usuario el tiempo de pausa (1 a 15 min)
        const pauseDurationInput = prompt("¿Por cuántos minutos quieres pausar el chat? (1 a 15 minutos)");
        
        if (pauseDurationInput === null || pauseDurationInput.trim() === "") {
            return; // Cancelado
        }

        const durationMinutes = parseInt(pauseDurationInput);

        if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 15) {
            alert("⚠️ Por favor, ingresa un número válido entre 1 y 15.");
            return;
        }

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
        lastPauseTime = now;
        localStorage.setItem("lastPauseTime", now);
        
        alert(`⏳ Chat pausado exitosamente por ${durationMinutes} minutos. ¡Desconectá un rato!`);
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
    
    // Renderiza todos los mensajes
    function renderMessages() { 
        messagesContainer.innerHTML = "";
        if (!currentChat || !chats[currentChat]) return;

        chats[currentChat].forEach(msg => {
            const div = document.createElement("div");
            div.className = msg.sender === currentUser ? "message sent" : "message received";
            div.textContent = msg.text;

            const ts = document.createElement("span");
            ts.className = "ts";
            const d = new Date(msg.time);
            ts.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            div.appendChild(ts);

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

    // Lógica de EMISIÓN del mensaje con Detección de Insultos (SIN MODAL)
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
            sender: currentUser,
            text,
            time: new Date().toISOString()
        };

        // Emitir el mensaje al servidor
        socket.emit("sendMessage", msgData);

        // Añadir el mensaje localmente
        addMessage(msgData);

        messageInput.value = "";
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
    
    // Conexión del botón de enviar (NUEVO BOTÓN)
    sendBtnIcon.addEventListener("click", sendMessage);
    
    // Conexión del botón de pausa (NUEVA FUNCIÓN)
    pauseChatBtn.addEventListener("click", tryPauseChat);
    
    chatListDiv.addEventListener("click", e => {
        if (e.target.classList.contains("add-chat")) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            tryOpenChat(key); 
        }
    });
    
    backBtn.addEventListener("click", () => {
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
    });
    
    // --- Lógica de Recepción (Socket.io) ---

    // Lógica de RECEPCIÓN (Mensajes)
    socket.on("receiveMessage", (msgData) => { 
        if (msgData.sender !== currentUser) {
            addMessage(msgData);
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