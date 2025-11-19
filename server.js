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
// VARIABLES Y ESTADO DEL SERVIDOR
// =======================================================
// Almacena el estado completo: socketId, mood y status (online/offline/paused).
const userStates = {}; 
const getPartnerName = (userName) => (userName === "Leo" ? "Estefi" : "Leo");

// ------------------------------------------------------------------
// 1. Archivos Estáticos: Los archivos de la carpeta 'public' se sirven directamente.
// ------------------------------------------------------------------
app.use(express.static("public")); 

// ------------------------------------------------------------------
// 2. Rutas HTML: Apuntan a los archivos dentro de la carpeta 'public'.
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
// 3. LÓGICA DE SOCKET.IO
// =======================================================

io.on("connection", (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // ----------------------------------------------------
    // 1. REGISTRO Y EMISIÓN INICIAL DE ESTADO (LOGIN)
    // ----------------------------------------------------
    socket.on("registerUser", (data) => {
        const userName = data.user;
        const mood = data.mood || '😴';
        const status = 'online';

        socket.userName = userName; // Guardar el nombre de usuario en el socket
        
        // Registrar o actualizar el estado del usuario
        userStates[userName] = { 
            socketId: socket.id, 
            mood: mood, 
            status: status 
        };
        
        console.log(`Usuario registrado: ${userName} (Mood: ${mood})`);

        // Notificar a la pareja
        const partnerName = getPartnerName(userName);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            // Notificar a la pareja que el usuario se conectó
            io.to(partnerState.socketId).emit("statusChanged", {
                sender: userName,
                mood: mood,
                status: status
            });

            // Enviar el estado de la pareja al usuario que acaba de ingresar
            socket.emit('partnerStatus', {
                user: partnerName,
                mood: partnerState.mood, 
                status: partnerState.status
            });
        }
    });
    
    // ----------------------------------------------------
    // 2. CAMBIO DE ESTADO DE ÁNIMO
    // ----------------------------------------------------
    socket.on("changeMood", (data) => {
        const userName = socket.userName;
        const newMood = data.mood;

        if (userName && userStates[userName]) {
            userStates[userName].mood = newMood; // Actualizar mood en el estado del servidor
            
            console.log(`Mood de ${userName} cambiado a: ${newMood}`);
            
            // Notificar a la pareja
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("moodChanged", {
                    sender: userName,
                    mood: newMood
                });
            }
        }
    });
    
    // ----------------------------------------------------
    // 3. ENVÍO DE MENSAJES
    // ----------------------------------------------------
    socket.on("sendMessage", (data) => {
        const sender = socket.userName;
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];
        
        // data contiene: { message, chatId }

        if (partnerState && partnerState.socketId) {
            // Reenviar el mensaje al destinatario
            io.to(partnerState.socketId).emit("newMessage", {
                sender: sender,
                chatId: data.chatId,
                message: data.message // Incluye text, id, replyToId
            });
            console.log(`Mensaje enviado por ${sender} al chat ${data.chatId}.`);
        } else {
            // Esto solo es útil para depuración. En producción no es necesario.
            console.log(`Mensaje enviado por ${sender}, pero ${partnerName} está desconectado.`);
        }
    });

    // ----------------------------------------------------
    // 4. CHAT LEÍDO (Marcar como leídos)
    // ----------------------------------------------------
    socket.on('readChat', (data) => {
        const reader = data.reader;
        const partnerName = getPartnerName(reader);
        const partnerState = userStates[partnerName];
        
        // data contiene: { chatKey, reader }
        
        if (partnerState && partnerState.socketId) {
            // Notificar a la pareja que el chat fue leído
            io.to(partnerState.socketId).emit("messagesRead", {
                reader: reader,
                chatKey: data.chatKey
            });
        }
    });
    
    // ----------------------------------------------------
    // 5. MARCAR MENSAJE COMO IMPORTANTE
    // ----------------------------------------------------
    socket.on('markImportant', (data) => {
        const sender = socket.userName;
        const messageId = data.messageId;

        if (!sender || !messageId || !data.chatId) return;

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
    // 6. SOLICITUD DE ESTADO DE LA PAREJA (Para sincronización)
    // ----------------------------------------------------
    socket.on('requestPartnerStatus', (data) => {
        const targetUser = data.target;
        
        if (userStates[targetUser]) {
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

    // ----------------------------------------------------
    // 7. MANEJO DE DESCONEXIÓN (OFFLINE)
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