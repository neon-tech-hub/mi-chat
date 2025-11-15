(() => {
    "use strict";

    const socket = io(); 
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // --- Variables de Estado ---
    const AVAILABLE_MOODS = ["❤️", "😊", "😴", "😢", "😠", "😅", "✨", "⏳"];
    // 🔴 NUEVA VARIABLE: Lista de palabras a prohibir (Insultos)
    const PROHIBITED_WORDS = [
        "tonto", "estúpido", "idiota", "imbécil", "boludo", "pelotudo", 
        "tarado", "mierda", "puto", "gil", "cabrón", "zorra", "pendejo",
        "carajo", "caca", "vaca", "bruto", "imbecil" // Puedes expandir esta lista
    ];
    let chats = {};
    let currentChat = null;
    
    // Almacenamiento del estado de la pareja (NUEVO)
    let partnerMood = sessionStorage.getItem("partnerMood") || "?"; 
    
    // Referencias al DOM
    const chatListDiv = document.getElementById("chatList");
    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");
    const chatPartner = document.getElementById("chatPartner"); 
    const partnerStatus = document.getElementById("partnerStatus"); 
    const messagesContainer = document.getElementById("messages");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const backBtn = document.getElementById("backBtn");
    const modal = document.getElementById("confirmModal");
    const modalYes = document.getElementById("modalYes");
    const modalNo = document.getElementById("modalNo");
    
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

    // 🔴 NUEVA FUNCIÓN: Verifica si el texto contiene palabras prohibidas
    function containsInsult(text) {
        const lowerCaseText = text.toLowerCase();
        
        // Comprueba si alguna palabra prohibida está incluida en el texto
        const foundInsult = PROHIBITED_WORDS.some(word => lowerCaseText.includes(word));
        
        return foundInsult;
    }

    // --- Lógica de Renderizado y Flujo ---

    // La función renderChatList completa y robusta
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
    
    // (Restaurada) Renderiza todos los mensajes
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

    // (Restaurada) Añade un mensaje al historial y lo renderiza
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

    // (Restaurada y Modificada) Lógica de EMISIÓN del mensaje con Detección de Insultos
    const sendMessage = () => { 
        if (!currentChat) {
            alert("Seleccioná un chat primero.");
            return;
        }

        const text = messageInput.value.trim();
        if (!text) return;

        // 🔴 DETECCIÓN DE INSULTOS
        if (containsInsult(text)) {
            alert("🚫 ¡Atención! Tu mensaje no debe contener insultos o palabras ofensivas. Por favor, revisá tu redacción.");
            return; // Bloquea el envío
        }
        
        // Si no hay insultos, muestra el modal de confirmación
        modal.style.display = "block";
    };

    // --- Lógica de Event Listeners ---

    // Lógica para ABRIR el selector de estados (Sin cambios)
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

        // 1. Guardar mi estado emocional localmente para la restricción (NUEVO)
        sessionStorage.setItem("myMood", selectedMood);

        // 2. Emitir el estado al servidor
        socket.emit("updateMood", moodData);

        // 3. Ocultar el selector de estados
        moodsContainer.classList.remove("active");
    });
    
    // Conexión del botón de enviar
    sendBtn.addEventListener("click", sendMessage);
    
    // (Restaurada y Modificada) Lógica del modal de confirmación: SÍ
    modalYes.addEventListener("click", () => { 
        const text = messageInput.value.trim();
        if (!text) {
            modal.style.display = "none";
            return;
        }

        // 🔴 DETECCIÓN DE INSULTOS (Revisar de nuevo antes de enviar)
        if (containsInsult(text)) {
            alert("🚫 ¡Error! Tu mensaje contiene insultos. Por favor, revisá tu redacción antes de confirmar.");
            modal.style.display = "none";
            return; // Bloquea el envío
        }

        // Si no hay insultos, procede al envío
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
        modal.style.display = "none";
    }); 
    
    modalNo.addEventListener("click", () => { modal.style.display = "none"; });
    
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
    
    // Lógica de RECEPCIÓN DE ESTADOS (Persistencia del estado de la pareja)
    socket.on("moodChanged", (data) => {
        if (data.sender !== currentUser) {
            emojiCircle.textContent = data.mood;
            sessionStorage.setItem("partnerMood", data.mood);
            partnerMood = data.mood;
        }
    });

    // Lógica de RECEPCIÓN DE ESTADOS (Status, por si existe el elemento)
    socket.on("statusChanged", (data) => { 
        if (data.sender !== currentUser && partnerStatus) {
            partnerStatus.textContent = data.status;
        }
    });

    // --- Inicialización ---

    // 1. Asegurarse de que el chat de hoy exista (siempre)
    const todayKey = formatDateKey();
    if (!chats[todayKey]) {
        chats[todayKey] = [];
        saveData();
    }

    // 2. Cargar el estado de la pareja si existe (PERSISTENCIA)
    emojiCircle.textContent = partnerMood; 

    // 3. Mostrar la pantalla principal y renderizar todo
    mainScreen.classList.add("active"); 
    renderChatList(); 
    renderMoods(); 
})();