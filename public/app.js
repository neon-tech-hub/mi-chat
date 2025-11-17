// =======================================================
// A. PARTE DE LOGIN (Recuperada de tu primer mensaje)
// =======================================================

// Contraseñas válidas
const PASSWORDS = {
    Leo: "12345678",
    Estefi: "87654321"
};

const loginBtn = document.getElementById("loginBtn");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

if (loginBtn) {
    // Evento login (solo se ejecuta si estamos en la pantalla de login)
    loginBtn.addEventListener("click", () => {
        const user = loginUser.value.trim();
        const pass = loginPassword.value.trim();

        loginError.textContent = "";

        if (!user || !pass) {
            loginError.textContent = "Ingrese usuario y contraseña.";
            return;
        }

        if (!PASSWORDS[user] || PASSWORDS[user] !== pass) {
            loginError.textContent = "Usuario o contraseña incorrecta.";
            return;
        }

        // Guardado SOLO durante la sesión actual
        sessionStorage.setItem("currentUser", user);

        window.location.href = "index.html";
    });

    // Permitir Enter
    [loginUser, loginPassword].forEach(input => {
        input.addEventListener("keypress", e => {
            if (e.key === "Enter") loginBtn.click();
        });
    });
}

// =======================================================
// B. PARTE DE CHAT/INTERFAZ
// =======================================================

(() => {
    "use strict";
    
    // Si no tenemos socket.io cargado, salimos.
    if (typeof io === 'undefined') return;

    const socket = io();
    const currentUser = sessionStorage.getItem("currentUser");
    const partnerName = currentUser === "Leo" ? "Estefi" : "Leo"; // Nuevo

    
    if (!currentUser && window.location.pathname.endsWith('index.html')) {
        window.location.href = "login.html";
        return;
    }

    // Si estamos en login, la lógica de abajo no se ejecuta.
    if (window.location.pathname.endsWith('login.html')) return; 

    // CRUCIAL: Notificar al servidor quién eres para el manejo de estados de conexión (online/offline)
    socket.emit('registerUser', currentUser); 

    // --- Variables de Estado y Control ---
    const AVAILABLE_MOODS = ["❤️", "😊", "😴", "😢", "😠", "😅", "✨", "⏳"];
    
    // 🔴 Mapeo de Emojis a Clases CSS (para la sombra de la Zona Verde)
    const MOOD_CLASSES = {
        "❤️": "enamorado", // Nuevo
        "😊": "happy",
        "😴": "cansado",
        "😢": "sad",
        "😠": "angry",
        "😅": "ansioso",
        "✨": "inspirado",
        "⏳": "ocupado",
        "?": "default" 
    };

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
    
    // 🔴 Opciones de pausa predefinidas en minutos
    const PAUSE_OPTIONS = [2, 5, 8, 10, 12, 15]; 
    const PAUSE_COOLDOWN = 60 * 60 * 1000; // 1 hora en milisegundos

    // Control de la última pausa (para la restricción de 1 vez por hora)
    let lastPauseTime = localStorage.getItem("lastPauseTime") ? parseInt(localStorage.getItem("lastPauseTime")) : 0;
    
    // 🔴 Variables para la funcionalidad de Responder
    let messageToReplyId = null; 
    let messageToReplyText = null; 

    const PROHIBITED_WORDS = [
        "tonto", "estúpido", "idiota", "imbécil", "boludo", "pelotudo", 
        "tarado", "mierda", "puto", "gil", "cabrón", "zorra", "pendejo",
        "carajo", "caca", "vaca", "bruto", "imbecil" 
    ];
    let chats = {};
    let currentChat = null;
    
    // Almacenamiento del estado de la pareja
    let partnerMood = sessionStorage.getItem("partnerMood") || "?"; 
    let myMood = sessionStorage.getItem("myMood") || "?"; // Estado de ánimo del usuario actual

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
    
    // NUEVAS REFERENCIAS para el diseño actualizado
    const sendBtnIcon = document.getElementById("sendBtnIcon"); 
    const pauseChatBtn = document.getElementById("pauseChatBtn"); 
    const backBtn = document.getElementById("backBtn");
    
    // Elementos del estado emocional
    const emojiCircle = document.getElementById("emojiCircle"); 
    const openStateModal = document.getElementById("openStateModal"); 
    const moodsContainer = document.getElementById("moodsContainer");
    const moodList = document.getElementById("moodList");

    // 🔴 NUEVAS REFERENCIAS para Modales de Interacción y Pausa
    const pauseTimeModal = document.getElementById("pauseTimeModal");
    const pauseTimeButtons = document.getElementById("pauseTimeButtons");
    const messageActionsModal = document.getElementById("messageActionsModal");
    const selectedMessageText = document.getElementById("selectedMessageText");
    const replyMessageBtn = document.getElementById("replyMessageBtn");
    const markImportantBtn = document.getElementById("markImportantBtn");
    
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
    
    // 🟢 FUNCIÓN: Control de la Sombra Emocional (Zona Verde)
    /**
     * Asigna dinámicamente el color de sombra del círculo emocional
     * @param {string} moodEmoji - El emoji actual de la pareja
     */
    function updateEmotionalCircle(moodEmoji) {
        const emojiCircle = document.getElementById('emojiCircle');
        // 🔴 CORRECCIÓN: Usa el mapeo MOOD_CLASSES (ej. 'happy' o 'enamorado')
        const moodClass = MOOD_CLASSES[moodEmoji]; 

        if (emojiCircle) {
            // 1. Limpiar todas las clases de estado previas (mood-*)
            emojiCircle.className = 'emoji-circle'; 
            
            // 2. Aplicar la nueva clase de sombra (ej: mood-enojado)
            if (moodClass && moodClass !== 'default') {
                 // Añade 'mood-' + nombre de la clase
                 emojiCircle.classList.add(`mood-${moodClass}`);
            }
        }
    }
    
    // 🔴 FUNCIÓN: Actualiza el botón de estado en el header (Zona Roja)
    function updateMyMoodButton(moodEmoji) {
        const defaultEmoji = moodEmoji === '?' ? '😴' : moodEmoji;
        openStateModal.textContent = defaultEmoji;
    }


    // FUNCIÓN CRUCIAL: Gestiona el estado de Conexión y Emocional de la pareja
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
        
        // 🟢 LLAMADA A LA FUNCIÓN DE CONTROL VISUAL para aplicar la sombra
        updateEmotionalCircle(moodEmoji);
    }
    
    // 🔴 CORRECCIÓN SCROLL: Scroll al último mensaje (para la barra fija)
    function scrollToBottom() {
        // Usamos un pequeño timeout para dar tiempo al navegador a calcular la nueva altura del teclado
        setTimeout(() => {
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 150); 
    }

    // 🔴 NUEVA Lógica de Pausa con Lista de Opciones (Reemplaza tryPauseChat)
    
    function openPauseModal() {
        const now = new Date().getTime();

        if (now - lastPauseTime < PAUSE_COOLDOWN) {
            const remainingTimeSeconds = Math.ceil((PAUSE_COOLDOWN - (now - lastPauseTime)) / 1000);
            const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
            alert(`❌ Debes esperar ${remainingMinutes} minutos más para volver a pausar el chat (1 pausa por hora).`);
            return;
        }

        // Generar botones de tiempo dinámicamente
        pauseTimeButtons.innerHTML = PAUSE_OPTIONS.map(min => 
            `<button class="btn primary small pause-option" data-minutes="${min}">${min} min</button>`
        ).join('');

        pauseTimeModal.style.display = 'flex';
    }

    function applyPause(durationMinutes) {
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
        lastPauseTime = new Date().getTime();
        localStorage.setItem("lastPauseTime", lastPauseTime);
        
        alert(`⏳ Chat pausado exitosamente por ${durationMinutes} minutos. ¡Desconectá un rato!`);
        pauseTimeModal.style.display = 'none';
    }


    // 🔴 FUNCIÓN REVISADA: Actualiza el estado 'leído' del mensaje y notifica al servidor
    function updateMessageReadStatus(messageId) {
        if (!currentChat) return;
        
        // Encuentra el chat y el mensaje
        const chat = chats[currentChat];
        const msg = chat.find(m => m.id === messageId);

        // Solo marcamos como leído si el mensaje fue recibido y aún no está marcado
        if (msg && msg.sender !== currentUser && !msg.read) {
            msg.read = true;
            saveData();
            // Notificar al servidor que el mensaje fue leído
            socket.emit("messageRead", { chatId: currentChat, messageId: messageId });
        }
    }

    // --- Lógica de Renderizado y Flujo (Resto de funciones) ---

    // 🔴 FUNCIÓN CORREGIDA: Incluye el contador de mensajes nuevos y oculta el texto.
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
            // Asumiendo que el formato es DD-MM, lo convertimos a un objeto Date para comparar
            const currentYear = new Date().getFullYear(); 
            const parseDate = (key) => {
                const parts = key.split("-");
                return new Date(`${currentYear}-${parts[1]}-${parts[0]}`);
            };
            
            return parseDate(b) - parseDate(a); // Orden descendente (más nuevo primero)
        });

        // 2. Renderizar los chats existentes
        if (days.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chat-item empty-message";
            empty.innerHTML = `
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
                
                const chatMessages = chats[day] || []; // Asegurarse de que sea un array
                const lastMsg = (chatMessages.length)
                    ? chatMessages[chatMessages.length - 1]
                    : null;
                    
                // 1. LÓGICA CLAVE: Contamos cuántos mensajes RECIBIDOS NO leídos tiene este chat
                const unreadMessagesCount = chatMessages.filter(
                    msg => msg.sender !== currentUser && !msg.read
                ).length;
                
                // 2. Determinar si hay algún mensaje no leído
                const hasUnread = unreadMessagesCount > 0;
                
                if (hasUnread) {
                    btn.classList.add('unread');
                }
                
                // 3. LÓGICA CLAVE: Ocultar el mensaje si hay no leídos y mostrar el contador
                let chatLastContent = "Toca para empezar a hablar";
                if (lastMsg) {
                    if (hasUnread) {
                        // Muestra el contador y oculta el contenido del mensaje
                        const plural = unreadMessagesCount > 1 ? 's' : '';
                        chatLastContent = `${unreadMessagesCount} mensaje${plural} nuevo${plural}`;
                    } else {
                        // Si está todo leído (o son mensajes enviados por ti), muestra el último mensaje
                        const senderName = lastMsg.sender === currentUser ? `Tú:` : `${partnerName}:`;
                        chatLastContent = `${senderName} ${lastMsg.text}`;
                    }
                }

                btn.innerHTML = `
                    <div class="meta">
                        <div class="chat-name">Chat ${day}</div>
                        <div class="chat-last">${chatLastContent}</div>
                    </div>
                    <span class="chat-date">${day}</span>
                `;
                btn.onclick = () => tryOpenChat(day);
                chatListDiv.appendChild(btn);
            });
        }
    }

    // Función: Verifica si el usuario puede entrar al chat (Restricción de Estado)
    function tryOpenChat(day) {
        myMood = sessionStorage.getItem("myMood"); // Actualizamos la variable

        if (!myMood || myMood === "?") {
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

        chatPartner.textContent = partnerName;
        // La llamada a renderMessages() aquí es lo que activa la lectura de los mensajes no leídos
        renderMessages();
        
        // 🟢 Forzar el scroll al abrir el chat
        scrollToBottom(); 
    }
    
    // 🔴 FUNCIÓN REVISADA: renderMessages para corregir el estado "Leído" (solo en el último enviado)
    function renderMessages() { 
        messagesContainer.innerHTML = "";
        if (!currentChat || !chats[currentChat]) return;

        // 1. Determinar el ID del ÚLTIMO mensaje que fue ENVIADO por el usuario actual (TÚ).
        let lastSentMessageId = null;
        const allSentMessages = chats[currentChat].filter(msg => msg.sender === currentUser);
        if (allSentMessages.length > 0) {
            lastSentMessageId = allSentMessages[allSentMessages.length - 1].id;
        }

        // 2. Renderizar mensajes
        chats[currentChat].forEach(msg => {
            const div = document.createElement("div");
            div.className = msg.sender === currentUser ? "message sent" : "message received";
            div.dataset.messageId = msg.id; 
            
            // 🟢 Resaltado para MENSAJE IMPORTANTE
            if (msg.isImportant) {
                div.classList.add(msg.sender === currentUser ? 'important-local' : 'important-remote');
            }

            // 🟢 Bloque de RESPUESTA
            if (msg.replyToText) {
                const replyBlock = document.createElement('div');
                replyBlock.className = 'reply-block';
                const originalSenderName = msg.replyToId.endsWith(currentUser) ? 'Tú' : (currentUser === "Leo" ? "Estefi" : "Leo");
                replyBlock.innerHTML = `
                    <strong>${originalSenderName}:</strong> ${msg.replyToText}
                `;
                div.appendChild(replyBlock);
            }

            const msgText = document.createElement('p');
            msgText.textContent = msg.text;
            div.appendChild(msgText);

            const ts = document.createElement("span");
            ts.className = "ts";
            const d = new Date(msg.time);
            ts.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            div.appendChild(ts);

            // 🔴 LÓGICA DE LECTURA (APLICADA EN EL CONTENEDOR DE MENSAJES, NO EN LA BURBUJA)
            messagesContainer.appendChild(div);

            // 🔴 Si es un mensaje ENVIADO Y es el ÚLTIMO que enviaste Y está marcado como leído
            if (msg.sender === currentUser && msg.id === lastSentMessageId && msg.read) {
                const readStatus = document.createElement('span');
                readStatus.className = 'read-status'; // Estilo: texto gris, alineado a la derecha
                readStatus.textContent = 'Leído';
                // 🔴 Lo añadimos AL CONTENEDOR de mensajes, DESPUÉS del mensaje
                messagesContainer.appendChild(readStatus); 
            }
            
            // 🔴 Si es un mensaje RECIBIDO, marcamos como leído al verlo (SÓLO si aún no está leído)
            if (msg.sender !== currentUser) {
                // updateMessageReadStatus se encarga de verificar que msg.read sea false antes de marcar y notificar.
                updateMessageReadStatus(msg.id); 
            }
        });
        
        scrollToBottom();
    }

    // Añade un mensaje al historial y lo renderiza
    function addMessage(msgData) { 
        const dayKey = formatDateKey(new Date(msgData.time));
        if (!chats[dayKey]) chats[dayKey] = [];
        chats[dayKey].push(msgData);
        saveData();

        if (dayKey === currentChat) {
            // Si estamos en el chat, se re-renderiza y automáticamente se marcan como leídos
            renderMessages();
        }
        // Siempre actualiza la lista para mostrar el indicador/contador
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

    // 🔴 Modificación de sendMessage para incluir ID y datos de respuesta/importante
    const sendMessage = () => { 
        if (!currentChat) {
            alert("Seleccioná un chat primero.");
            return;
        }
        
        // Bloquear envío si el chat está pausado
        if(messageInput.disabled) return;

        const text = messageInput.value.trim();
        if (!text) return;

        // DETECCIÓN DE INSULTOS
        if (containsInsult(text)) {
            alert("🚫 ¡Atención! Tu mensaje no debe contener insultos o palabras ofensivas. Por favor, revisá tu redacción.");
            return; // Bloquea el envío si hay insulto
        }
        
        // Si no hay insultos, procede directamente al envío
        const msgData = {
            id: new Date().getTime().toString(), // 🔴 ID único CRUCIAL
            sender: currentUser,
            text,
            time: new Date().toISOString(),
            read: false, // 🔴 Se inicializa en FALSE, solo cambia al recibir el evento del server
            replyToId: messageToReplyId, 
            replyToText: messageToReplyText, 
            isImportant: false 
        };

        // Emitir el mensaje al servidor
        socket.emit("sendMessage", msgData);

        // Añadir el mensaje localmente
        addMessage(msgData);

        messageInput.value = "";

        // 🔴 Restablecer el estado de respuesta
        messageToReplyId = null;
        messageToReplyText = null;
        messageInput.placeholder = "Escribe tu mensaje..."; 
    };

    // --- Lógica de Event Listeners ---

    // Lógica para ABRIR el selector de estados (Zona Roja)
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
        myMood = selectedMood; // Actualizamos la variable local

        // 2. Emitir el estado al servidor
        socket.emit("updateMood", moodData);

        // 3. Ocultar el selector de estados y actualizar el botón
        moodsContainer.classList.remove("active");
        updateMyMoodButton(myMood); // 🔴 Actualiza el botón de la Zona Roja
    });
    
    // Conexión del botón de enviar
    sendBtnIcon.addEventListener("click", sendMessage);
    
    // 🔴 CORRECCIÓN SCROLL: Eventos para fijar la barra de chat al escribir (Scroll y Foco)
    messageInput.addEventListener('focus', () => {
        // Asegura que la barra de input esté visible y el último mensaje esté encima del teclado
        scrollToBottom();
        // Delay extra para dispositivos móviles donde el teclado aparece con retraso
        setTimeout(scrollToBottom, 200); 
    });
    messageInput.addEventListener('input', scrollToBottom);


    // 🔴 Conexión del botón de pausa al nuevo modal
    pauseChatBtn.addEventListener("click", openPauseModal);

    // 🔴 Listener para la selección de tiempo en el modal de pausa
    pauseTimeButtons.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains('pause-option')) {
            const duration = parseInt(target.dataset.minutes);
            if (!isNaN(duration)) {
                applyPause(duration);
            }
        }
    });

    // 🔴 Listener para cerrar los modales
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    chatListDiv.addEventListener("click", e => {
        if (e.target.classList.contains("add-chat")) {
            const key = formatDateKey();
            if (!chats[key]) chats[key] = [];
            saveData();
            renderChatList();
            tryOpenChat(key); 
        }
    });
    
    // 🔴 NUEVA LÓGICA: Alerta si intenta salir sin responder un mensaje importante
    backBtn.addEventListener("click", () => {
        // 1. Si no hay chat activo o no hay mensajes, salir directamente
        if (!currentChat || !chats[currentChat] || chats[currentChat].length === 0) {
            chatScreen.classList.remove("active");
            mainScreen.classList.add("active");
            // Re-renderizar la lista de chats para actualizar el estado de lectura/no lectura
            renderChatList(); 
            return;
        }

        // 2. Buscar el último mensaje *marcado como importante* que el currentUser *recibió*
        const importantReceivedMessage = chats[currentChat].slice().reverse().find(
            msg => msg.isImportant && msg.sender !== currentUser
        );

        if (importantReceivedMessage) {
            // 3. Comprobar si ya existe una respuesta directa a ese mensaje
            const hasReplied = chats[currentChat].some(
                msg => msg.sender === currentUser && msg.replyToId === importantReceivedMessage.id
            );

            if (!hasReplied) {
                // 4. Mostrar la alerta de confirmación si NO ha respondido
                const confirmation = confirm(
                    `⚠️ ¡Alerta de Pareja! ⚠️\n\nTu pareja marcó el mensaje: "${importantReceivedMessage.text.substring(0, 50)}..." como importante.\n\n¿Seguro que querés salir sin responder?`
                );

                if (!confirmation) {
                    // Si el usuario cancela, se queda en el chat
                    return;
                }
            }
        }

        // 5. Si no hay mensaje importante, ya se respondió, o el usuario confirmó la salida, salir
        chatScreen.classList.remove("active");
        mainScreen.classList.add("active");
        // Re-renderizar la lista de chats para actualizar el estado de lectura/no lectura
        renderChatList(); 
    });

    // 🔴 NUEVO: Lógica para abrir el menú de acciones al hacer clic en un mensaje
    messagesContainer.addEventListener('click', (e) => {
        let target = e.target.closest('.message');
        if (!target) return;

        const messageId = target.dataset.messageId;
        
        // Obtener el objeto mensaje real
        const msg = chats[currentChat].find(m => m.id === messageId);
        if (!msg) return;

        // Configurar la ventana modal
        messageActionsModal.style.display = 'flex';
        messageActionsModal.dataset.messageId = messageId;
        selectedMessageText.textContent = msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : '');

        // Deshabilitar "Marcar Importante" si ya lo está O si es un mensaje que recibí (solo puedo marcar los que envié)
        markImportantBtn.disabled = msg.isImportant || msg.sender !== currentUser;
        
        // El botón Responder siempre está disponible
    });

    // 🔴 NUEVO: Listener para el botón RESPONDER
    replyMessageBtn.addEventListener('click', () => {
        const messageId = messageActionsModal.dataset.messageId;
        const msg = chats[currentChat].find(m => m.id === messageId);

        if (msg) {
            // Almacenar el ID y Texto para el próximo envío
            messageToReplyId = messageId;
            messageToReplyText = msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''); 

            // Indicar al usuario que está respondiendo y cerrar modal
            messageInput.placeholder = `Respondiendo a: "${messageToReplyText}"`;
            messageInput.focus();
            messageActionsModal.style.display = 'none';
        }
    });

    // 🔴 NUEVO: Listener para el botón MARCAR IMPORTANTE
    markImportantBtn.addEventListener('click', () => {
        const messageId = messageActionsModal.dataset.messageId;
        const msgIndex = chats[currentChat].findIndex(m => m.id === messageId);

        if (msgIndex !== -1) {
            // Marcar localmente
            chats[currentChat][msgIndex].isImportant = true;
            saveData();
            renderMessages(); // Actualizar la visualización para el resaltado

            // Notificar al servidor (y al otro usuario)
            socket.emit("markImportant", { chatId: currentChat, messageId: messageId });

            messageActionsModal.style.display = 'none';
            alert("🌟 Mensaje marcado como importante. ¡Tu pareja recibirá una alerta si intenta salir sin responder!");
        }
    });

    // --- Lógica de Recepción (Socket.io) ---

    // Lógica de RECEPCIÓN (Mensajes)
    socket.on("receiveMessage", (msgData) => { 
        if (msgData.sender !== currentUser) {
            addMessage(msgData);
        }
    });
    
    // 🔴 NUEVO: Lógica de RECEPCIÓN de estado de lectura (read) y marcado (important)
    socket.on("messageStatusUpdate", (data) => {
        const dayKey = data.chatId;
        if (chats[dayKey]) {
            const msg = chats[dayKey].find(m => m.id === data.messageId);
            if (msg) {
                if (data.status === 'read' && data.sender !== currentUser) {
                    // Actualización de estado de lectura (recibido por el remitente original)
                    msg.read = true;
                } else if (data.status === 'important' && data.sender !== currentUser) {
                    // Actualización de estado importante (recibido por el destinatario)
                    msg.isImportant = true;
                }

                saveData();
                
                // Solo re-renderizar si estamos en la pantalla del chat
                if (dayKey === currentChat) {
                    renderMessages();
                } else {
                    // Si no estamos en el chat, actualizar la lista de chats para el indicador "no leído"
                    renderChatList();
                }
            }
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
    
    // 🔴 NUEVO: Inicializar el botón de estado emocional del usuario actual (Zona Roja)
    myMood = sessionStorage.getItem("myMood") || "?";
    updateMyMoodButton(myMood);

    // 3. Mostrar la pantalla principal y renderizar todo (ahora chats ya tiene el chat de hoy)
    mainScreen.classList.add("active"); 
    renderChatList(); 
    renderMoods(); 
})();