(() => {
    "use strict";

    // Obtener usuario actual desde sessionStorage
    let currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    const socket = io?.() ?? { on: () => {}, emit: () => {} };

    let currentChat = null;
    let pauseActive = false;
    let lastPause = 0;

    let chats = {};
    let userStates = { Leo: "", Estefi: "" };
    let onlineStatus = { Leo: false, Estefi: false };

    const BAD_WORDS = ["tonto", "idiota", "estupido", "feo"];

    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");
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

    // -----------------------------
    // Funciones de almacenamiento
    // -----------------------------
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

    // -----------------------------
    // Renderizar lista de chats
    // -----------------------------
    function renderChatList() {
        if (!chatListDiv) return;
        chatListDiv.innerHTML = '';

        // Botón crear nuevo chat
        const addBtn = document.createElement("button");
        addBtn.className = "add-chat";
        addBtn.title = "Nuevo chat (hoy)";
        addBtn.innerText = "+";
        chatListDiv.appendChild(addBtn);

        const days = Object.keys(chats).sort((a,b)=> {
            const A = new Date(a.split("-").reverse().join("-"));
            const B = new Date(b.split("-").reverse().join("-"));
            return B - A;
        });

        const partner = currentUser === "Leo" ? "Estefi" : "Leo";

        if (days.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chat-item";
            empty.innerHTML = `<div class="avatar" aria-hidden="true"></div>
                               <div class="meta">
                                 <div class="chat-name">Sin chats</div>
                                 <div class="chat-last">Presioná + para iniciar</div>
                               </div>`;
            chatListDiv.appendChild(empty);
            return;
        }

        days.forEach(day => {
            const btn = document.createElement("button");
            btn.className = "chat-item";

            const stateText = userStates[partner] ? `${userStates[partner]}` : "";
            const statusText = onlineStatus[partner] ? `En línea ${stateText}` : `Ausente ${stateText}`;

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

    // -----------------------------
    // Renderizar mensajes
    // -----------------------------
    function renderMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = "";
        if (!currentChat || !chats[currentChat]) return;

        chats[currentChat].forEach(msg => {
            const div = document.createElement("div");
            div.className = `message ${msg.sender === currentUser ? "sent" : "received"}`;

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

    // -----------------------------
    // Actualizar estado pareja
    // -----------------------------
    function updatePartnerStatusUI() {
        if (!partnerStatus) return;
        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        const state = userStates[pareja] || "";
        partnerStatus.textContent = onlineStatus[pareja] ? `En línea ${state}` : `Ausente ${state}`;

        if (chatAvatar) {
            chatAvatar.style.background = pareja === "Estefi"
                ? "linear-gradient(135deg, #f58529, #dd2a7b)"
                : "linear-gradient(135deg, #515bd4, #8134af)";
        }
    }

    // -----------------------------
    // Click + crear chat
    // -----------------------------
    chatListDiv.addEventListener("click", (e) => {
        if (!e.target) return;
        const target = e.target;
        if (target.classList.contains("add-chat") || target.closest(".add-chat")) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            openChat(key);
            return;
        }
    });

    // -----------------------------
    // Abrir chat
    // -----------------------------
    function openChat(day) {
        if (!currentUser) return;

        currentChat = day;
        mainScreen.classList.remove("active");
        chatScreen.classList.add("active");

        const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
        chatPartner.textContent = pareja;

        updatePartnerStatusUI();
        renderMessages();

        onlineStatus[currentUser] = true;
        saveData();
    }

    // -----------------------------
    // Enviar mensaje
    // -----------------------------
    sendBtn.addEventListener("click", () => {
        if (!currentChat) return alert("Seleccione un chat primero.");
        if (pauseActive) return alert("Chat pausado.");

        const text = messageInput.value.trim();
        if (!text) return;
        if (containsBadWord(text)) return alert("Detectamos palabras fuertes.");

        modalText.textContent = "¿Está bien redactado tu mensaje?";
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    });

    modalYes.addEventListener("click", () => {
        const text = messageInput.value.trim();
        if (!text) {
            modal.style.display = "none";
            return;
        }
        if (!chats[currentChat]) chats[currentChat] = [];
        const msgObj = { sender: currentUser, text: text, time: new Date().toISOString() };
        chats[currentChat].push(msgObj);
        saveData();

        messageInput.value = "";
        modal.style.display = "none";
        renderMessages();
        renderChatList();
    });

    modalNo.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // -----------------------------
    // Botón volver
    // -----------------------------
    backBtn.addEventListener("click", () => {
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
        onlineStatus[currentUser] = false;
        saveData();
    });

    // -----------------------------
    // Iniciar render
    // -----------------------------
    renderChatList();
    updatePartnerStatusUI();

})();
