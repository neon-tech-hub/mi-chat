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
// ✅ 2. Rutas HTML: Apuntan a los archivos dentro de la carpeta 'public'.
// ------------------------------------------------------------------

// RUTA RAÍZ (http://localhost:3000/ -> public/login.html)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html')); 
});

// RUTA DEL MENÚ (Solicitada como /menu.html -> public/menu.html)
app.get("/menu.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html')); 
});

// RUTA DE LA CONVERSACIÓN (Solicitada como /chat.html -> public/chat.html)
app.get("/chat.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html')); 
});


// =======================================================
// LÓGICA DE SOCKET.IO (Sincronización de Estados y Chat)
// =======================================================
io.on('connection', socket => {
    console.log("Usuario conectado. Socket ID:", socket.id);

    // ----------------------------------------------------
    // 1. REGISTRO DEL USUARIO AL CONECTARSE
    // ----------------------------------------------------
    socket.on('userConnected', data => {
        const userName = data.user;
        const userMood = data.mood || '?'; 
        socket.userName = userName;

        // Guardar estado completo
        userStates[userName] = {
            socketId: socket.id,
            mood: userMood,
            status: 'online'
        };
        
        const partnerName = getPartnerName(userName);
        const partnerState = userStates[partnerName];

        // Notificar a la pareja que el usuario está ONLINE
        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('statusChanged', {
                sender: userName, 
                status: 'online' 
            });
        }
        console.log(`Usuario conectado: ${userName}. Estado: ${userStates[userName].status}`);
    });

    // ----------------------------------------------------
    // 2. MANEJO DEL CAMBIO DE ÁNIMO (REENVÍO A LA PAREJA)
    // ----------------------------------------------------
    socket.on('moodChanged', data => {
        const sender = data.user; 
        const newMood = data.mood;
        
        // 1. Actualizar el estado en el servidor
        if (userStates[sender]) {
            userStates[sender].mood = newMood;
            userStates[sender].status = 'online'; // Por si acaso
        }

        // 2. Informar a la pareja sobre el nuevo ánimo
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('moodChanged', {
                sender: sender,
                mood: newMood
            });
            // También enviamos el status, por si la pareja estaba en chat.html
             io.to(partnerState.socketId).emit('statusChanged', {
                sender: sender,
                status: 'online' 
            });
        }
        console.log(`Mood cambiado: ${sender} a ${newMood}.`);
    });

    // ----------------------------------------------------
    // 3. SOLICITUD DE ESTADO DE LA PAREJA 
    // ----------------------------------------------------
    socket.on('requestPartnerStatus', data => {
        const targetUser = data.targetUser; 
        const partnerState = userStates[targetUser];

        if (partnerState && partnerState.socketId) {
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: partnerState.mood,
                status: partnerState.status 
            });
        } else {
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: '?', 
                status: 'offline'
            });
        }
    });
    
    // ----------------------------------------------------
    // 4. ENVÍO DE MENSAJES
    // ----------------------------------------------------
    socket.on("messageSent", (data) => {
        const partnerName = getPartnerName(data.sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
             io.to(partnerState.socketId).emit("newMessage", {
                sender: data.sender,
                chatKey: data.chatKey,
                message: data.message
            });
        }
    });
    
    // ----------------------------------------------------
    // 5. MARCAR MENSAJES COMO LEÍDOS
    // ----------------------------------------------------
    socket.on("readChat", (data) => {
        const partnerName = getPartnerName(data.reader);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit("messagesRead", {
                reader: data.reader,
                chatKey: data.chatKey
            });
        }
    });

    // ----------------------------------------------------
    // 6. MANEJO DE PAUSA (OPCIONAL)
    // ----------------------------------------------------
    socket.on('pauseChat', data => {
        const sender = data.user;
        const duration = data.duration;
        
        if (userStates[sender]) {
            userStates[sender].status = 'paused';
            
            const partnerName = getPartnerName(sender);
            const partnerState = userStates[partnerName];

            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit('chatPaused', {
                    sender: sender,
                    duration: duration
                });
            }
        }
        // Lógica para restablecer el estado después de 'duration' (omitiendo por simplicidad)
    });
    
    // ----------------------------------------------------
    // 7. MARCAR MENSAJE COMO IMPORTANTE
    // ----------------------------------------------------
     socket.on("markImportant", (data) => {
        const { sender, messageId } = data;
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