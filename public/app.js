const currentUser = sessionStorage.getItem("currentUser");
if (!currentUser) {
    window.location.href = "/login.html";
}

(() => {
    "use strict";

    const socket = io?.() ?? { on: () => {}, emit: () => {} };

    currentUser = sessionStorage.getItem("currentUser");
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
    const chatAvatar = document.getElementById("chatAvatar");

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
        } catch (e) {
            console.warn("No se pudo cargar data:", e);
        }
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
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight + 200;
        }
    }

    function renderChatList() {
        if (!chatListDiv) return;
        chatListDiv.innerHTML = '';

        // botón para crear nuevo chat (día actual)
        const addBtn = document.createElement("button");
        addBtn.className = "add-chat";
        addBtn.title = "Nuevo chat (hoy)";
        addBtn.innerText = "+";
        chatListDiv.appendChild(addBtn);

        const days = Object.keys(chats).sort((a,b)=> {
            // formato DD-MM => convertir a Date para ordenar
            const A = new Date(a.split("-").reverse().join("-"));
            const B = new Date(b.split("-").reverse().join("-"));
            return B - A;
        });

        const partner = currentUser === "Leo" ? "Estefi" : "Leo";

        if (days.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chat-item";
            empty.innerHTML = `<div class="avatar" aria-hidden="true"></div><div class="meta"><div class="chat-name">Sin chats</div><div class="chat-last">Presioná + para iniciar</div></div>`;
            chatListDiv.appendChild(empty);
            return;
        }

        days.forEach(day => {
            const btn = document.createElement("button");
            btn.className = "chat-item";
            const stateText = userStates[partner] ? `${userStates[partner]}` : "";
            const statusText = onlineStatus[partner] ? `En línea ${stateText}` : `Ausente ${stateText}`;

            // resumen último mensaje si existe
            const lastMsg = (chats[day] && chats[day].length) ? chats[day][chats[day].length - 1].text : "Sin mensajes";
            btn.innerHTML = `<div class="avatar" aria-hidden="true"></div>
                                <div class="meta">
                                    <div class="chat-name">Chat ${day}</div>
                                    <div class="chat-last">${lastMsg}</div>
                                </div>
                                <div style="font-size:.82rem; color: #bdbdbd; margin-left:8px;">${statusText}</div>`;

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

            // contenido y timestamp opcional
            const textNode = document.createElement("div");
            textNode.className = "text";
            textNode.textContent = msg.text;
            div.appendChild(textNode);

            const ts = document.createElement("span");
            ts.className = "ts";
            try {
                const d = new Date(msg.time || msg.hora || Date.now());
                const hh = String(d.getHours()).padStart(2,"0");
                const mm = String(d.getMinutes()).padStart(2,"0");
                ts.textContent = `${hh}:${mm}`;
            } catch { ts.textContent = ""; }
            div.appendChild(ts);

            messagesContainer.appendChild(div);
        });
        scrollMessagesToEnd();
    }

    function updatePartnerStatusUI() {
        if (!partnerStatus) return;
        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        const state = userStates[pareja] || "";
        partnerStatus.textContent = onlineStatus[pareja] ? `En línea ${state}` : `Ausente ${state}`;

        // avatar color/gradient alternado según pareja
        if (chatAvatar) {
            chatAvatar.style.background = pareja === "Estefi"
                ? "linear-gradient(135deg, #f58529, #dd2a7b)"
                : "linear-gradient(135deg, #515bd4, #8134af)";
        }
    }

    // SOCKETS (si existiesen)
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

    // LOGIN
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

        // mostrar pantalla principal
        loginScreen.classList.remove("active");
        mainScreen.classList.add("active");

        socket.emit("updateStatus", { user: currentUser, online: true });

        renderChatList();
        saveData();
        updatePartnerStatusUI();
    });

    // cambiar estado de ánimo
    userStateSelect.addEventListener("change", () => {
        if (!currentUser) return alert("Inicie sesión antes de cambiar su estado.");
        userStates[currentUser] = userStateSelect.value;
        saveData();
        socket.emit("updateMood", { user: currentUser, estado: userStates[currentUser] });
        renderChatList();
        updatePartnerStatusUI();
    });

    // click en la lista
    chatListDiv.addEventListener("click", (e) => {
        if (!e.target) return;
        const target = e.target;
        // si hizo click en el botón + (crear nuevo chat)
        if (target.classList && (target.classList.contains("add-chat") || target.closest(".add-chat"))) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            openChat(key);
            return;
        }
        // otros clicks delegados (cada item ya tiene onclick)
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

    // botón enviar: abrir modal de confirmación
    sendBtn.addEventListener("click", () => {
        if (!currentChat) return alert("Seleccione un chat primero.");
        if (pauseActive) return alert("Chat pausado. Espere a que termine la pausa.");
        const text = messageInput.value.trim();
        if (!text) return;
        if (containsBadWord(text)) return alert("Detectamos palabras fuertes. Por favor edítelo antes de enviar.");

        modalText.textContent = "¿Está bien redactado tu mensaje?";
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    });

    modalYes.addEventListener("click", () => {
        const text = messageInput.value.trim();
        if (!text) {
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
            return;
        }
        if (!chats[currentChat]) chats[currentChat] = [];
        const msgObj = { sender: currentUser, text: text, time: new Date().toISOString() };
        chats[currentChat].push(msgObj);
        saveData();

        socket.emit("sendMessage", { chat: currentChat, user: currentUser, text, hora: new Date().toISOString() });

        messageInput.value = "";
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        renderMessages();
        renderChatList();
    });

    modalNo.addEventListener("click", () => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    });

    // pausa 10 minutos (solo una vez por hora)
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
        if (currentUser) {
            onlineStatus[currentUser] = false;
            socket.emit("updateStatus", { user: currentUser, online: false });
            saveData();
        }
    });

    window.addEventListener("beforeunload", () => {
        if (currentUser) {
            onlineStatus[currentUser] = false;
            socket.emit("updateStatus", { user: currentUser, online: false });
            saveData();
        }
    });

    // iniciar render
    renderChatList();
    updatePartnerStatusUI();

})();
