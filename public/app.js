(() => {
    "use strict";

    const socket = io();

    let currentUser = null;
    let currentChat = null;
    let pauseActive = false;
    let lastPause = 0;

    let chats = {};
    let userStates = { Leo: "", Estefi: "" };
    let onlineStatus = { Leo: false, Estefi: false };

    const BAD_WORDS = ["tonto", "idiota", "estupido", "feo"];
    const PASSWORDS = { Leo: "12345678", Estefi: "87654321" };

    const loginScreen = document.getElementById("loginScreen");
    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");

    const userSelect = document.getElementById("userSelect");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    const userStateSelect = document.getElementById("userStateSelect");

    const chatListDiv = document.getElementById("chatList");

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

    function saveData() {
        localStorage.setItem("chatData", JSON.stringify({ chats, userStates, onlineStatus }));
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
        } catch {}
    }
    loadData();

    function formatDateKey(date = new Date()) {
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        return `${d}-${m}`;
    }

    function containsBadWord(text) {
        return BAD_WORDS.some(w => text.toLowerCase().includes(w));
    }

    function scrollMessagesToEnd() {
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderChatList() {
        if (!chatListDiv) return;
        chatListDiv.innerHTML = '<button class="add-chat">+</button>';

        const days = Object.keys(chats).sort((a,b)=> {
            const A = new Date(a.split("-").reverse().join("-"));
            const B = new Date(b.split("-").reverse().join("-"));
            return B - A;
        });

        const partner = currentUser === "Leo" ? "Estefi" : "Leo";

        days.forEach(day => {
            const btn = document.createElement("button");
            const stateText = userStates[partner] ? `${userStates[partner]}` : "";
            const statusText = onlineStatus[partner] ? `En línea ${stateText}` : `Ausente ${stateText}`;
            btn.textContent = `Chat día ${day} (${statusText})`;
            btn.onclick = () => openChat(day);
            chatListDiv.appendChild(btn);
        });
    }

    function renderMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = "";
        if (!currentChat || !chats[currentChat]) return;

        chats[currentChat].forEach(msg => {
            const div = document.createElement("div");
            div.className = `message ${msg.sender === currentUser ? "sent" : "received"}`;
            div.textContent = msg.text;
            messagesContainer.appendChild(div);
        });
        scrollMessagesToEnd();
    }

    function updatePartnerStatusUI() {
        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        const state = userStates[pareja] || "";
        partnerStatus.textContent = onlineStatus[pareja] ? `En línea ${state}` : `Ausente ${state}`;
    }

    socket.on("connect", () => {
        if (currentUser) {
            socket.emit("updateStatus", { user: currentUser, online: true });
            if (currentChat) socket.emit("joinChat", { chat: currentChat, user: currentUser });
        }
    });

    socket.on("receiveMessage", (data) => {
        if (!data || !data.chat) return;
        if (!chats[data.chat]) chats[data.chat] = [];
        chats[data.chat].push({ sender: data.user, text: data.text, time: new Date() });
        saveData();
        if (data.chat === currentChat) renderMessages();
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

        if (userStates[currentUser]) userStateSelect.value = userStates[currentUser];

        loginScreen.style.display = "none";
        mainScreen.classList.add("active");

        socket.emit("updateStatus", { user: currentUser, online: true });

        renderChatList();
        saveData();
    });

    userStateSelect.addEventListener("change", () => {
        if (!currentUser) return alert("Inicie sesión antes de cambiar su estado.");
        userStates[currentUser] = userStateSelect.value;
        saveData();
        socket.emit("updateMood", { user: currentUser, estado: userStates[currentUser] });
        renderChatList();
        updatePartnerStatusUI();
    });

    chatListDiv.addEventListener("click", (e) => {
        if (!e.target.classList) return;
        if (e.target.classList.contains("add-chat")) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            openChat(key);
        }
    });

    function openChat(day) {
        if (!currentUser || !userStates[currentUser]) {
            alert("Debe seleccionar su estado emocional antes de abrir un chat.");
            return;
        }

        currentChat = day;

        mainScreen.classList.remove("active");
        chatScreen.classList.add("active");

        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        chatPartner.textContent = pareja;

        updatePartnerStatusUI();
        renderMessages();

        onlineStatus[currentUser] = true;
        socket.emit("joinChat", { chat: currentChat, user: currentUser });
        socket.emit("updateStatus", { user: currentUser, online: true });

        saveData();
    }

    sendBtn.addEventListener("click", () => {
        if (!currentChat) return alert("Seleccione un chat primero.");
        if (pauseActive) return alert("Chat pausado. Espere a que termine la pausa.");
        const text = messageInput.value.trim();
        if (!text) return;
        if (containsBadWord(text)) return alert("Detectamos palabras fuertes. Por favor edítelo antes de enviar.");

        modalText.textContent = "¿Está bien redactado tu mensaje?";
        modal.style.display = "flex";
    });

    modalYes.addEventListener("click", () => {
        const text = messageInput.value.trim();
        if (!chats[currentChat]) chats[currentChat] = [];
        chats[currentChat].push({ sender: currentUser, text: text, time: new Date() });
        saveData();

        socket.emit("sendMessage", { chat: currentChat, user: currentUser, text, hora: new Date().toISOString() });

        messageInput.value = "";
        modal.style.display = "none";
        renderMessages();
    });

    modalNo.addEventListener("click", () => {
        modal.style.display = "none";
    });

    pauseBtn.addEventListener("click", () => {
        const now = Date.now();
        if (now - lastPause < 60 * 60 * 1000) return alert("Solo se puede pausar 1 vez por hora.");
        pauseActive = true;
        lastPause = now;
        let remaining = 10 * 60;
        pauseBtn.textContent = "Pausado 10:00";

        const interval = setInterval(() => {
            remaining--;
            const m = String(Math.floor(remaining/60)).padStart(2,"0");
            const s = String(remaining%60).padStart(2,"0");
            pauseBtn.textContent = `Pausado ${m}:${s}`;
            if (remaining <= 0) {
                clearInterval(interval);
                pauseActive = false;
                pauseBtn.textContent = "Pausar 10 min";
            }
        }, 1000);
    });

    backBtn.addEventListener("click", () => {
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
        onlineStatus[currentUser] = false;
        socket.emit("updateStatus", { user: currentUser, online: false });
        saveData();
    });

    window.addEventListener("beforeunload", () => {
        if (currentUser) {
            onlineStatus[currentUser] = false;
            socket.emit("updateStatus", { user: currentUser, online: false });
            saveData();
        }
    });

    renderChatList();
    updatePartnerStatusUI();

})();
