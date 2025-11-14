// public/app.js
// Chat para Conectar - Cliente
// Requisitos: <script src="/socket.io/socket.io.js"></script> antes de este archivo

(() => {
    "use strict";

    // =============================
    // Conexion Socket.IO
    // =============================
    const socket = io();

    // =============================
    // Estado Global
    // =============================
    let currentUser = null;
    let currentChat = null;
    let pauseActive = false;
    let lastPause = 0;

    let chats = {};
    let userStates = { Leo: "", Estefi: "" };
    let onlineStatus = { Leo: false, Estefi: false };

    const BAD_WORDS = ["tonto", "idiota", "estupido", "feo"];
    const PASSWORDS = { Leo: "12345678", Estefi: "87654321" };

    // =============================
    // Referencias DOM
    // =============================
    const loginScreen = document.getElementById("loginScreen");
    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");

    const userSelect = document.getElementById("userSelect");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    const chatListDiv = document.getElementById("chatList");
    const userStateSelect = document.getElementById("userStateSelect");

    const chatPartner = document.getElementById("chatPartner");
    const partnerStatus = document.getElementById("partnerStatus");

    const messagesContainer = document.getElementById("messages");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const backBtn = document.getElementById("backBtn");

    const modal = document.getElementById("confirmModal");
    const modalText = document.getElementById("modalText");
    const modalYes = document.getElementById("modalYes");
    const modalNo = document.getElementById("modalNo");

    // =============================
    // Util / LocalStorage
    // =============================
    function saveData() {
        const data = { chats, userStates, onlineStatus };
        try {
            localStorage.setItem("chatData", JSON.stringify(data));
        } catch (e) {
            console.warn("No se pudo guardar en localStorage:", e);
        }
    }

    function loadData() {
        try {
            const saved = localStorage.getItem("chatData");
            if (saved) {
                const data = JSON.parse(saved);
                chats = data.chats || {};
                userStates = data.userStates || userStates;
                onlineStatus = data.onlineStatus || onlineStatus;
            }
        } catch (e) {
            console.warn("No se pudo leer localStorage:", e);
        }
    }
    loadData();

    // =============================
    // Helpers
    // =============================
    function formatDateKey(date = new Date()) {
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        return `${d}-${m}`;
    }

    function containsBadWord(text) {
        const t = text.toLowerCase();
        return BAD_WORDS.some((w) => t.includes(w));
    }

    function scrollMessagesToEnd() {
        // Asegura que el contenedor exista
        if (!messagesContainer) return;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // =============================
    // Render UI
    // =============================
    function renderChatList() {
        if (!chatListDiv) return;
        chatListDiv.innerHTML = '<button class="add-chat">+</button>';

        const days = Object.keys(chats).sort((a, b) => {
            // transform dd-mm to date for sorting
            const A = new Date(a.split("-").reverse().join("-"));
            const B = new Date(b.split("-").reverse().join("-"));
            return B - A;
        });

        const partner = currentUser === "Leo" ? "Estefi" : "Leo";

        days.forEach((day) => {
            const btn = document.createElement("button");
            const stateText = userStates[partner] ? `${userStates[partner]}` : "";
            const statusText = onlineStatus[partner] ? `En línea ${stateText}` : `Ausente ${stateText}`;
            btn.textContent = `Chat día ${day} (${statusText})`;
            btn.onclick = () => openChat(day); // openChat valida internamente
            chatListDiv.appendChild(btn);
        });
    }

    function renderMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = "";
        if (!currentChat || !chats[currentChat]) return;

        chats[currentChat].forEach((msg) => {
            const div = document.createElement("div");
            div.className = `message ${msg.sender === currentUser ? "sent" : "received"}`;
            // Puedes mejorar aquí con hora, nombre, etc.
            div.textContent = msg.text;
            messagesContainer.appendChild(div);
        });

        // Desplazar al final
        scrollMessagesToEnd();
    }

    function updatePartnerStatusUI() {
        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        const state = userStates[pareja] || "";
        partnerStatus.textContent = onlineStatus[pareja] ? `En línea ${state}` : `Ausente ${state}`;
    }

    // =============================
    // Eventos del servidor (socket)
    // =============================
    socket.on("connect", () => {
        // console.log("Conectado al servidor socket:", socket.id);
        // Si ya estamos logueados, avisar estado actual
        if (currentUser) {
            socket.emit("updateStatus", { user: currentUser, online: true });
            // unir a la sala si hay chat abierto
            if (currentChat) socket.emit("joinChat", { chat: currentChat, user: currentUser });
        }
    });

    // Mensaje broadcast desde servidor
    socket.on("receiveMessage", (data) => {
        // data: { chat, user, text, hora? }
        if (!data || !data.chat) return;
        if (!chats[data.chat]) chats[data.chat] = [];
        chats[data.chat].push({ sender: data.user, text: data.text, time: data.hora || new Date() });
        saveData();

        // Si el mensaje pertenece al chat abierto, renderizamos
        if (data.chat === currentChat) renderMessages();
        // Si no está abierto, actualizamos la lista (para que muestre activo)
        else renderChatList();
    });

    socket.on("moodChanged", ({ user, estado }) => {
        if (!user) return;
        userStates[user] = estado;
        saveData();
        renderChatList();
        updatePartnerStatusUI();
    });

    socket.on("statusChanged", ({ user, online }) => {
        if (!user) return;
        onlineStatus[user] = !!online;
        saveData();
        renderChatList();
        updatePartnerStatusUI();
    });

    // =============================
    // Lógica: Login / Estado
    // =============================
    loginBtn.addEventListener("click", () => {
        const user = userSelect.value;
        const pass = passwordInput.value.trim();

        loginError.textContent = "";

        if (!user || !pass) {
            loginError.textContent = "Seleccione usuario y escriba la contraseña.";
            return;
        }

        if (PASSWORDS[user] !== pass) {
            loginError.textContent = "Usuario o contraseña incorrecta.";
            return;
        }

        currentUser = user;
        onlineStatus[currentUser] = true;

        // Si había estado guardado, precargarlo en el selector
        if (userStates[currentUser]) userStateSelect.value = userStates[currentUser];

        // UI
        if (loginScreen) loginScreen.style.display = "none";
        if (mainScreen) mainScreen.classList.add("active");

        // Notificar al servidor
        socket.emit("updateStatus", { user: currentUser, online: true });

        renderChatList();
        saveData();
    });

    userStateSelect.addEventListener("change", () => {
        if (!currentUser) return alert("Inicie sesión antes de cambiar su estado.");
        userStates[currentUser] = userStateSelect.value;
        saveData();

        // avisar a la otra parte en tiempo real
        socket.emit("updateMood", { user: currentUser, estado: userStates[currentUser] });

        renderChatList();
        updatePartnerStatusUI();
    });

    // =============================
    // Crear / abrir chats
    // =============================
    chatListDiv.addEventListener("click", (e) => {
        if (!e.target.classList) return;
        if (e.target.classList.contains("add-chat")) {
            // crear chat del dia
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            // Intentamos abrirlo; openChat valida estado emocional
            openChat(key);
        }
    });

    function openChat(day) {
        // Validar estado emocional
        if (!currentUser || !userStates[currentUser]) {
            alert("Debe seleccionar su estado emocional antes de abrir un chat.");
            return;
        }

        currentChat = day;

        // UI
        if (mainScreen) mainScreen.classList.remove("active");
        if (chatScreen) chatScreen.classList.add("active");

        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        if (chatPartner) chatPartner.textContent = pareja;

        updatePartnerStatusUI();
        renderMessages();

        // Marcar online y unirse a la sala en servidor (si el servidor soporta salas)
        onlineStatus[currentUser] = true;
        socket.emit("joinChat", { chat: currentChat, user: currentUser });
        socket.emit("updateStatus", { user: currentUser, online: true });

        saveData();
    }

    // =============================
    // Enviar Mensaje (modal de confirmacion)
    // =============================
    sendBtn.addEventListener("click", () => {
        if (!currentChat) return alert("Seleccione un chat primero.");
        if (pauseActive) return alert("Chat pausado. Espere a que termine la pausa.");

        const text = (messageInput && messageInput.value) ? messageInput.value.trim() : "";
        if (!text) return;

        if (containsBadWord(text)) {
            alert("Detectamos palabras fuertes. Por favor edítalo antes de enviar.");
            return;
        }

        modalText.textContent = "Esta página no fue diseñada para romper, sino para unir y entenderse sin dañar a nadie.\n¿Está bien redactado?";
        if (modal) modal.style.display = "flex";
    });

    modalYes.addEventListener("click", () => {
        const text = messageInput.value.trim();
        // Guardado local
        if (!chats[currentChat]) chats[currentChat] = [];
        chats[currentChat].push({ sender: currentUser, text: text, time: new Date() });
        saveData();

        // Enviar al servidor para que lo reenvíe a otros clientes
        socket.emit("sendMessage", {
            chat: currentChat,
            user: currentUser,
            text: text,
            hora: new Date().toISOString()
        });

        // Limpiar UI
        messageInput.value = "";
        if (modal) modal.style.display = "none";
        renderMessages();
    });

    modalNo.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
    });

    // =============================
    // Pause (10 minutos, 1 vez por hora)
    // =============================
    pauseBtn.addEventListener("click", () => {
        const now = Date.now();
        if (now - lastPause < 60 * 60 * 1000) return alert("Solo se puede pausar 1 vez por hora.");

        pauseActive = true;
        lastPause = now;
        let remaining = 10 * 60; // segundos
        pauseBtn.textContent = "Pausado 10:00";

        const interval = setInterval(() => {
            remaining--;
            const m = String(Math.floor(remaining / 60)).padStart(2, "0");
            const s = String(remaining % 60).padStart(2, "0");
            pauseBtn.textContent = `Pausado ${m}:${s}`;

            if (remaining <= 0) {
                clearInterval(interval);
                pauseActive = false;
                pauseBtn.textContent = "Pausar 10 min";
            }
        }, 1000);
    });

    // =============================
    // Back
    // =============================
    backBtn.addEventListener("click", () => {
        if (chatScreen) chatScreen.classList.remove("active");
        if (mainScreen) mainScreen.classList.add("active");
        if (currentUser) onlineStatus[currentUser] = false;
        socket.emit("updateStatus", { user: currentUser, online: false });
        saveData();
    });

    // =============================
    // Before unload
    // =============================
    window.addEventListener("beforeunload", () => {
        if (currentUser) {
            onlineStatus[currentUser] = false;
            socket.emit("updateStatus", { user: currentUser, online: false });
            saveData();
        }
    });

    // =============================
    // Inicialización final
    // =============================
    // Si hay estado guardado para el usuario, precargar en el selector al cargar la app (si alguien ya inició session)
    if (userSelect && userStateSelect && currentUser) {
        if (userStates[currentUser]) userStateSelect.value = userStates[currentUser];
    }

    // Render inicial
    renderChatList();
    updatePartnerStatusUI();

})(); 
