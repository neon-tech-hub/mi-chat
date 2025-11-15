(() => {
    "use strict";

    // ✅ CORRECCIÓN 1: INICIALIZACIÓN DE SOCKET.IO
    const socket = io(); // Conecta el cliente al servidor WebSocket

    // Obtener usuario de sessionStorage
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // ... (El resto de tus referencias al DOM y datos, sin cambios)
    
    // Referencias al DOM
    const chatListDiv = document.getElementById("chatList");
    const mainScreen = document.getElementById("mainScreen");
    const chatScreen = document.getElementById("chatScreen");
    // ... (otras referencias DOM)
    const messagesContainer = document.getElementById("messages");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const backBtn = document.getElementById("backBtn");
    const modal = document.getElementById("confirmModal");
    const modalYes = document.getElementById("modalYes");
    const modalNo = document.getElementById("modalNo");
    const emojiCircle = document.getElementById("emojiCircle");
    const openStateModal = document.getElementById("openStateModal");


    // Datos (La lógica de guardado local se deja para historial, pero el envío es por socket)
    let chats = {};
    let currentChat = null;

    // Funciones de almacenamiento (se mantienen para guardar historial localmente)
    function saveData() {
        localStorage.setItem("chatData", JSON.stringify({ chats }));
    }
    
    // ... (loadData, formatDateKey, renderChatList, openChat, renderMessages, sin cambios)
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
    
    function openChat(day) {
        currentChat = day;
        mainScreen.classList.remove("active");
        chatScreen.classList.add("active");

        chatPartner.textContent = currentUser === "Leo" ? "Estefi" : "Leo";
        renderMessages();
    }
    
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
    
    // Función central para añadir un mensaje (se usará en envío local y recepción de socket)
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

    // 2. ✅ CORRECCIÓN 2: Lógica de EMISIÓN (Reemplaza el guardado local por el envío al servidor)
    const sendMessage = () => {
        if (!currentChat) {
            alert("Seleccioná un chat primero.");
            return;
        }

        const text = messageInput.value.trim();
        if (!text) return;

        const msgData = {
            sender: currentUser,
            text,
            time: new Date().toISOString()
        };

        // Emitir el mensaje al servidor, que lo reenviará a todos
        socket.emit("sendMessage", msgData); 

        // Añadir el mensaje localmente (ya que socket.io no reenvía al emisor por defecto)
        addMessage(msgData);

        messageInput.value = "";
    };

    // Enviar mensaje (modificado para usar la función sendMessage)
    sendBtn.addEventListener("click", sendMessage);

    // Confirmación modal (modificado para usar la función sendMessage)
    modalYes.addEventListener("click", () => {
        const text = messageInput.value.trim();
        if (!text) {
            modal.style.display = "none";
            return;
        }

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
    
    // ✅ CORRECCIÓN 3: Lógica de RECEPCIÓN
    // Escuchar el evento 'receiveMessage' que viene del servidor
    socket.on("receiveMessage", (msgData) => {
        // Ignorar el mensaje si lo envié yo mismo, ya lo agregué con addMessage()
        if (msgData.sender !== currentUser) {
                addMessage(msgData);
        }
    });
    
    // ✅ CORRECCIÓN 4: RECEPCIÓN DE ESTADOS (Mood y Status)
    socket.on("moodChanged", (data) => {
        // Asegúrate de que tienes un elemento para el emoji: emojiCircle
        emojiCircle.textContent = data.mood;
    });

    socket.on("statusChanged", (data) => {
        // Asegúrate de que tienes un elemento para el estado: partnerStatus
        partnerStatus.textContent = data.status;
    });

    // Inicialización
    // Asegúrate de que la pantalla principal sea visible al inicio
    mainScreen.classList.add("active"); 
    renderChatList();
})();