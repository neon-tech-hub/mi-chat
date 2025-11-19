const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});
const path = require('path');

// =======================================================
// VARIABLES Y ESTADO DEL SERVIDOR (Fix de Sincronización)
// =======================================================
// Almacena el estado completo: socketId, mood y status (online/offline/paused).
const userStates = {}; 
const getPartnerName = (userName) => (userName === "Leo" ? "Estefi" : "Leo");

// ------------------------------------------------------------------
// ✅ 1. Archivos Estáticos: Esto permite que el navegador encuentre /menu.js, /chat.css, etc.
// ------------------------------------------------------------------
app.use(express.static("public")); 

// ------------------------------------------------------------------
// ✅ 2. Rutas HTML: Apuntan a los archivos dentro de la carpeta 'public'. (Fix de 'Not Found')
// ------------------------------------------------------------------

// RUTA RAÍZ (http://localhost:3000/ -> public/login.html)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html')); 
});

// RUTA DEL MENÚ (Solicitada como /menu.html -> public/menu.html)
app.get("/menu.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// RUTA DEL CHAT (Solicitada como /chat.html -> public/chat.html)
app.get("/chat.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// ----------------------------------------------------
// 3. LÓGICA DE SOCKETS (EVENTOS DE CONEXIÓN/ESTADO)
// ----------------------------------------------------
io.on("connection", (socket) => {
    console.log("Nuevo usuario conectado. Socket ID:", socket.id);

    // 1. MANEJO DE LOGIN (Establece el estado inicial)
    socket.on("userLogin", (userName) => {
        socket.userName = userName;
        const partnerName = getPartnerName(userName);

        if (!userStates[userName]) {
            userStates[userName] = {
                socketId: null,
                mood: "😴", // Estado inicial predeterminado
                status: 'online'
            };
        }

        // Actualizar socketId y estado a 'online'
        userStates[userName].socketId = socket.id;
        userStates[userName].status = 'online';

        console.log(`Usuario logeado: ${userName}. Estado: online.`);
        
        // Notificar a la pareja que el usuario está ONLINE
        const partnerState = userStates[partnerName];
        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit("statusChanged", {
                sender: userName,
                status: 'online'
            });
            // Notificar al usuario logeado el estado de su pareja
            socket.emit('partnerStatus', {
                user: partnerName,
                mood: partnerState.mood,
                status: partnerState.status 
            });
        }
    });

    // 2. CAMBIO DE ESTADO DE ÁNIMO
    socket.on('changeMood', (data) => {
        const { mood } = data;
        const userName = socket.userName;
        const partnerName = getPartnerName(userName);

        if (userName && userStates[userName]) {
            userStates[userName].mood = mood;
            console.log(`Estado de ánimo de ${userName} cambiado a: ${mood}`);

            // Notificar a la pareja
            const partnerState = userStates[partnerName];
            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("moodChanged", {
                    sender: userName,
                    mood: mood
                });
            }
        }
    });

    // 3. ENVÍO DE MENSAJES (chatKey es 'discutir', 'consolar', 'debatir')
    socket.on("messageSent", (data) => {
        const sender = socket.userName;
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            // Reenviar el mensaje al socket de la pareja
            io.to(partnerState.socketId).emit("newMessage", {
                sender: sender,
                chatKey: data.chatKey, 
                message: data.message 
            });
            console.log(`Mensaje enviado por ${sender} al chat ${data.chatKey}.`);
        } else {
            // Opcional: manejar el caso de que la pareja esté offline (ej. guardar en DB)
            console.log(`Mensaje de ${sender} no enviado, ${partnerName} está offline.`);
        }
    });

    // 4. MANEJO DE PAUSA DE CHAT (Bloqueo de 5 min)
    socket.on("chatPaused", (data) => {
        const sender = socket.userName;
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            // Notificar a la pareja
            io.to(partnerState.socketId).emit("chatPaused", {
                sender: sender,
                duration: data.duration 
            });

            // Opcional: Podrías cambiar el estado del usuario en userStates a 'paused' temporalmente
            if (userStates[sender]) {
                userStates[sender].status = 'paused';
                // Implementar un timer para revertir el estado después de data.duration minutos.
                setTimeout(() => {
                    if (userStates[sender] && userStates[sender].status === 'paused') {
                        userStates[sender].status = 'online';
                        if (partnerState.socketId) {
                             io.to(partnerState.socketId).emit("statusChanged", {
                                sender: sender,
                                status: 'online'
                            });
                        }
                    }
                }, data.duration * 60 * 1000); 
            }
        }
    });
    
    // 5. SOLICITUD DE ESTADO DE LA PAREJA (Al cargar menu.html o chat.html)
    socket.on('requestPartnerStatus', (data) => {
        const targetUser = data.targetUser; // 'Leo' o 'Estefi'
        
        if (userStates[targetUser] && userStates[targetUser].socketId) {
            // Responder con el estado actual
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: userStates[targetUser].mood,
                status: userStates[targetUser].status 
            });
        } else {
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: '?', 
                status: 'offline'
            });
        }
    });

    // 6. MENSAJES LEÍDOS
    socket.on('readChat', (data) => {
        const sender = data.reader; // El que leyó el mensaje
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit("messagesRead", {
                reader: sender,
                chatKey: data.chatKey
            });
        }
    });

    // 7. MARCAR MENSAJE COMO IMPORTANTE
    socket.on('markImportant', (data) => {
        const sender = socket.userName;
        const messageId = data.messageId; 
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit("messageMarked", {
                sender: sender,
                chatId: data.chatId, // Se asume que el chatId viene en los datos
                messageId: messageId
            });
        }
    });


    // ----------------------------------------------------
    // 8. MANEJO DE DESCONEXIÓN (OFFLINE)
    // ----------------------------------------------------
    socket.on("disconnect", () => {
        const userName = socket.userName;
        
        if (userName && userStates[userName]) {
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            // Notificar a la pareja
            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("statusChanged", {
                    sender: userName,
                    status: 'offline'
                });
            }
            
            // Actualizar el estado a 'offline' y eliminar socketId
            userStates[userName].status = 'offline';
            delete userStates[userName].socketId; 
            console.log(`Usuario desconectado: ${userName}.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));