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

    // --- Lógica de Renderizado y Flujo ---

    // 🔴 CORRECCIÓN 1: La función renderChatList completa y robusta
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
                // 🔴 CAMBIO 3: El evento onclick llama a una función que verifica el estado
                btn.onclick = () => tryOpenChat(day);
                chatListDiv.appendChild(btn);
            });
        }
    }

    // 🔴 NUEVA FUNCIÓN: Verifica si el usuario puede entrar al chat
    function tryOpenChat(day) {
        // Obtenemos el estado emocional del usuario actual (NUEVO)
        const myCurrentMood = sessionStorage.getItem("myMood");
        
        if (!myCurrentMood || myCurrentMood === "?") {
            alert("⚠️ ¡Debes seleccionar tu estado emocional antes de entrar a un chat!");
            openStateModal.click(); // Abre el modal de estados para obligar la selección
            return;
        }
        
        // Si hay estado seleccionado, abre el chat
        openChat(day);
    }
    
    function openChat(day) {
        currentChat = day;
        mainScreen.classList.remove("active");
        chatScreen.classList.add("active");

        chatPartner.textContent = currentUser === "Leo" ? "Estefi" : "Leo";
        renderMessages();
    }
    
    function renderMessages() { /* ... (Mantener la función renderMessages) ... */ }
    function addMessage(msgData) { /* ... (Mantener la función addMessage) ... */ }
    
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

    // Lógica de EMISIÓN del mensaje (Sin cambios)
    const sendMessage = () => { /* ... (Mantener la función sendMessage) ... */ };

    // --- Lógica de Event Listeners ---

    // Lógica para ABRIR el selector de estados (Sin cambios)
    openStateModal.addEventListener("click", () => {
        moodsContainer.classList.add("active"); 
    });

    // 🔴 CAMBIO 4: Lógica para SELECCIONAR y EMITIR el estado
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
    
    // (Otros Event Listeners: sendBtn, modalYes, modalNo, chatListDiv, backBtn, sin cambios)
    sendBtn.addEventListener("click", sendMessage);
    modalYes.addEventListener("click", () => { /* ... */ }); 
    modalNo.addEventListener("click", () => { modal.style.display = "none"; });
    chatListDiv.addEventListener("click", e => {
        if (e.target.classList.contains("add-chat")) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            tryOpenChat(key); // 🔴 CAMBIO 5: Usar tryOpenChat para el botón + de chat
        }
    });
    backBtn.addEventListener("click", () => {
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
    });
    
    // --- Lógica de Recepción (Socket.io) ---

    // Lógica de RECEPCIÓN (Mensajes - Sin cambios)
    socket.on("receiveMessage", (msgData) => { /* ... */ });
    
    // 🔴 CAMBIO 2: Lógica de RECEPCIÓN DE ESTADOS (Persistencia del estado de la pareja)
    socket.on("moodChanged", (data) => {
        // Solo actualizar si el estado NO viene de mí mismo
        if (data.sender !== currentUser) {
                emojiCircle.textContent = data.mood;

             // GUARDAR el estado de la pareja en sessionStorage (PERSISTENCIA)
                sessionStorage.setItem("partnerMood", data.mood);
                partnerMood = data.mood;
        }
    });

    socket.on("statusChanged", (data) => { /* ... */ });

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