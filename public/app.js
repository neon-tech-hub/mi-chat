(() => {
    "use strict";

    const socket = io(); 
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // Emojis disponibles
    const AVAILABLE_MOODS = ["❤️", "😊", "😴", "😢", "😠", "😅", "✨", "⏳"];
    
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
    
    // Elementos del estado emocional (NUEVAS Y CLAVES)
    const emojiCircle = document.getElementById("emojiCircle"); 
    const openStateModal = document.getElementById("openStateModal"); 
    const moodsContainer = document.getElementById("moodsContainer");
    const moodList = document.getElementById("moodList");

    // Datos
    let chats = {};
    let currentChat = null;

    // --- Funciones de Utilidad y Almacenamiento (Sin cambios) ---

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

    // --- Lógica de Renderizado (Sin cambios mayores) ---

    function renderChatList() { /* ... (Mantener la función renderChatList) ... */ }
    function openChat(day) { /* ... (Mantener la función openChat) ... */ }
    function renderMessages() { /* ... (Mantener la función renderMessages) ... */ }
    function addMessage(msgData) { /* ... (Mantener la función addMessage) ... */ }
    
    // **NUEVA FUNCIÓN:** Renderiza los botones de emojis
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

    // --- Lógica de Emisión y Event Listeners ---

    // Lógica de EMISIÓN del mensaje (Sin cambios)
    const sendMessage = () => { /* ... (Mantener la función sendMessage) ... */ };

    // 🔴 CORRECCIÓN CLAVE 1: Lógica para ABRIR el selector de estados
    openStateModal.addEventListener("click", () => {
        moodsContainer.classList.add("active"); // Muestra el contenedor/modal
    });

    // 🔴 CORRECCIÓN CLAVE 2: Lógica para SELECCIONAR y EMITIR el estado
    moodList.addEventListener("click", (e) => {
        const selectedMood = e.target.dataset.mood;
        if (!selectedMood) return;

        const moodData = {
            sender: currentUser,
            mood: selectedMood
        };

        // 1. Emitir el estado al servidor
        socket.emit("updateMood", moodData);

        // 2. Ocultar el selector de estados
        moodsContainer.classList.remove("active");
        
        // NO actualizamos emojiCircle localmente (así solo se ve el de la pareja)
        console.log(`Estado emocional enviado: ${selectedMood}`);
    });
    
    // Listener para cerrar el modal haciendo click fuera (si tienes estilos CSS para el modal)
    moodsContainer.addEventListener("click", (e) => {
        if (e.target.id === 'moodsContainer') {
            moodsContainer.classList.remove("active");
        }
    });


    // (Otros Event Listeners como sendBtn, modalYes, chatListDiv, backBtn, sin cambios)
    sendBtn.addEventListener("click", sendMessage);
    modalYes.addEventListener("click", () => { /* ... */ }); 
    modalNo.addEventListener("click", () => { modal.style.display = "none"; });
    chatListDiv.addEventListener("click", e => { /* ... */ }); 
    backBtn.addEventListener("click", () => {
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
    });
    
    // --- Lógica de Recepción (Socket.io) ---

    // Lógica de RECEPCIÓN (Mensajes - Sin cambios)
    socket.on("receiveMessage", (msgData) => {
        if (msgData.sender !== currentUser) {
            addMessage(msgData);
        }
    });
    
    // 🔴 CORRECCIÓN CLAVE 3: Lógica de RECEPCIÓN DE ESTADOS (Solo mostrar si es de la pareja)
    socket.on("moodChanged", (data) => {
        // Solo actualizar si el estado NO viene de mí mismo
        if (data.sender !== currentUser) {
                emojiCircle.textContent = data.mood;
        }
        // Si el estado viene de mí, no hago nada, el círculo queda con el estado de la pareja
    });

    socket.on("statusChanged", (data) => {
        if (data.sender !== currentUser) {
            partnerStatus.textContent = data.status;
        }
    });

    // --- Inicialización ---
    mainScreen.classList.add("active"); 
    renderChatList();
    renderMoods(); // Renderiza la lista de emojis al inicio
})();