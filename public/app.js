(() => {
    "use strict";

    // Obtener usuario de sessionStorage
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // Referencias al DOM
    const chatListDiv = document.getElementById("chatList");
    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");
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

    // Datos
    let chats = {};
    let currentChat = null;

    // Funciones de almacenamiento
    function saveData() {
        localStorage.setItem("chatData", JSON.stringify({ chats }));
    }

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

    // Utilidades
    function formatDateKey(date = new Date()) {
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        return `${d}-${m}`;
    }

    // Render lista de chats
    function renderChatList() {
        chatListDiv.innerHTML = "";

        const addBtn = document.createElement("button");
        addBtn.className = "add-chat";
        addBtn.title = "Nuevo chat (hoy)";
        addBtn.innerText = "+";
        chatListDiv.appendChild(addBtn);

        const days = Object.keys(chats).sort((a, b) => {
        const A = new Date(a.split("-").reverse().join("-"));
        const B = new Date(b.split("-").reverse().join("-"));
        return B - A;
        });

        if (days.length === 0) {
        const empty = document.createElement("div");
        empty.className = "chat-item";
        empty.innerHTML = `
            <div class="avatar"></div>
            <div class="meta">
            <div class="chat-name">Sin chats</div>
            <div class="chat-last">Presioná + para iniciar</div>
            </div>
        `;
        chatListDiv.appendChild(empty);
        } else {
        days.forEach(day => {
            const btn = document.createElement("button");
            btn.className = "chat-item";
            const lastMsg = (chats[day] && chats[day].length)
            ? chats[day][chats[day].length - 1].text
            : "Sin mensajes";
            btn.innerHTML = `
            <div class="avatar"></div>
            <div class="meta">
                <div class="chat-name">Chat ${day}</div>
                <div class="chat-last">${lastMsg}</div>
            </div>
            `;
            btn.onclick = () => openChat(day);
            chatListDiv.appendChild(btn);
        });
        }
    }

    // Abrir chat
    function openChat(day) {
        currentChat = day;
        mainScreen.classList.remove("active");
        chatScreen.classList.add("active");

        chatPartner.textContent = currentUser === "Leo" ? "Estefi" : "Leo";
        renderMessages();
    }

    // Render mensajes
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

    // Enviar mensaje
    sendBtn.addEventListener("click", () => {
        if (!currentChat) {
        alert("Seleccioná un chat primero.");
        return;
        }

        const text = messageInput.value.trim();
        if (!text) return;

        if (!chats[currentChat]) chats[currentChat] = [];
        chats[currentChat].push({
        sender: currentUser,
        text,
        time: new Date().toISOString()
        });
        saveData();
        messageInput.value = "";
        renderMessages();
        renderChatList();
    });

    // Confirmación modal
    modalYes.addEventListener("click", () => {
        const text = messageInput.value.trim();
        if (!text) {
        modal.style.display = "none";
        return;
        }
        if (!chats[currentChat]) chats[currentChat] = [];
        chats[currentChat].push({
        sender: currentUser,
        text,
        time: new Date().toISOString()
        });
        saveData();
        messageInput.value = "";
        modal.style.display = "none";
        renderMessages();
        renderChatList();
    });

    modalNo.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Crear chat con botón +
    chatListDiv.addEventListener("click", e => {
        if (e.target.classList.contains("add-chat")) {
        const key = formatDateKey();
        if (!chats[key]) chats[key] = [];
        saveData();
        renderChatList();
        openChat(key);
        }
    });

    // Volver al listado
    backBtn.addEventListener("click", () => {
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
    });

    // Inicialización
    renderChatList();
})();
