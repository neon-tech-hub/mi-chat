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


// =======================================================
// LÓGICA DE SOCKET.IO
// =======================================================

io.on('connection', (socket) => {
    console.log('Un usuario conectado. Socket ID:', socket.id);

    // ----------------------------------------------------
    // 1. MANEJO DE LOGIN (Establecer la identidad)
    // ----------------------------------------------------
    socket.on("login", (userName, mood) => {
        
        // Limpiar socketId anterior si existe (reconexión)
        for (const user in userStates) {
            if (userStates[user] && userStates[user].socketId === socket.id) {
                delete userStates[user].socketId; 
            }
        }

        // Establecer identidad del socket
        socket.userName = userName;

        // Actualizar o crear estado del usuario
        if (!userStates[userName]) {
            userStates[userName] = { mood: '😴', status: 'offline', socketId: null };
        }
        userStates[userName].mood = mood; // El mood inicial lo manda el cliente
        userStates[userName].status = 'online';
        userStates[userName].socketId = socket.id;

        const partnerName = getPartnerName(userName);
        const partnerState = userStates[partnerName];

        // 1.4 Emitir el estado completo de la pareja al usuario que acaba de ingresar
        if (partnerState && partnerState.socketId) {
            socket.emit('partnerStatus', {
                user: partnerName,
                mood: partnerState.mood,
                status: partnerState.status
            });

            // 1.5 Notificar a la pareja que el usuario ha ingresado (Actualización en tiempo real)
            io.to(partnerState.socketId).emit("statusChanged", {
                sender: userName,
                mood: mood,
                status: 'online'
            });
        }
    });

    // ----------------------------------------------------
    // 2. MANEJO DE CAMBIO DE MOOD
    // ----------------------------------------------------
    socket.on("moodChanged", (newMood) => {
        const userName = socket.userName;

        if (userName && userStates[userName]) {
            userStates[userName].mood = newMood;
            
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            // Notificar a la pareja
            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("statusChanged", {
                    sender: userName,
                    mood: newMood,
                    status: userStates[userName].status // No cambiamos el status (sigue online/paused)
                });
            }
        }
    });

    // ----------------------------------------------------
    // 3. SOLICITAR ESTADO DE PAREJA (Para sincronización manual)
    // ----------------------------------------------------
    socket.on('requestPartnerStatus', (targetUser) => {
        
        if (userStates[targetUser] && userStates[targetUser].socketId) {
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: userStates[targetUser].mood,
                status: userStates[targetUser].status 
            });
        } else {
            // Si la pareja no está conectada
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: userStates[targetUser] ? userStates[targetUser].mood : '?', 
                status: 'offline'
            });
        }
    });
    
    // ----------------------------------------------------
    // 4. MANEJO DE PAUSA DE CHAT
    // ----------------------------------------------------
    socket.on("chatPaused", (duration) => {
        const userName = socket.userName;
        if (userName && userStates[userName]) {
            userStates[userName].status = 'paused';
            
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("statusChanged", {
                    sender: userName,
                    status: 'paused'
                });
                io.to(partnerState.socketId).emit("chatPaused", {
                    sender: userName,
                    duration: duration
                });
            }
        }
    });

    // ----------------------------------------------------
    // 5. MANEJO DE MENSAJE ENVIADO
    // ----------------------------------------------------
    // Asume que 'message' es un objeto completo (text, timestamp, isImportant, replyTo)
    socket.on("messageSent", (message) => {
        const userName = socket.userName;
        if (userName) {
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            // Reenviar a la pareja
            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("newMessage", {
                    sender: userName,
                    message: message 
                });
            }
        }
    });
    
    // ----------------------------------------------------
    // 6. MANEJO DE MENSAJES LEÍDOS
    // ----------------------------------------------------
    socket.on("messagesRead", () => {
        const userName = socket.userName;
        if (userName) {
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            // Notificar a la pareja
            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("partnerMessagesRead", {
                    reader: userName
                });
            }
        }
    });
    
    // ----------------------------------------------------
    // 7. MANEJO DE MARCAR IMPORTANTE
    // ----------------------------------------------------
    socket.on("markImportant", (messageId) => {
        const userName = socket.userName;
        if (userName) {
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("messageMarkedImportant", {
                    marker: userName,
                    messageId: messageId
                });
            }
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
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));