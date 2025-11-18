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
// Almacenamiento de estado completo de usuarios
// =======================================================
const userStates = {}; 
const getPartnerName = (userName) => (userName === "Leo" ? "Estefi" : "Leo");

// ------------------------------------------------------------------
// ✅ CORRECCIÓN DE RUTAS: Servir todos los archivos estáticos desde la raíz
// Esto es vital para que cargue menu.js, styles.css, etc.
// ------------------------------------------------------------------
app.use(express.static(__dirname)); 

// 1. RUTA RAÍZ (Página de Login) - http://localhost:3000/
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); 
});

// 2. ✅ RUTA DEL MENÚ (CORREGIDA: Carga el archivo menu.html)
// Si el cliente redirige a '/menu.html', cargamos el archivo 'menu.html'.
app.get("/menu.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html')); 
});

// 3. RUTA DE LA CONVERSACIÓN
// Si el cliente redirige a '/chat.html', cargamos el archivo 'chat.html'.
app.get("/chat.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});


// Conexión de clientes (Lógica de Socket.io)
io.on('connection', socket => {
    console.log("Usuario conectado:", socket.id);

    // ----------------------------------------------------
    // 1. REGISTRO DEL USUARIO AL CONECTARSE
    // ----------------------------------------------------
    socket.on('userConnected', data => {
        const userName = data.user;
        const userMood = data.mood || '?'; 
        socket.userName = userName;

        userStates[userName] = {
            socketId: socket.id,
            mood: userMood,
            status: 'online'
        };
        
        const partnerName = getPartnerName(userName);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('statusChanged', {
                sender: userName, 
                status: 'online' 
            });
        }
        
        console.log(`Usuario registrado: ${userName}. Mood: ${userMood}`);
    });

    // ----------------------------------------------------
    // 2. MANEJO DEL CAMBIO DE ÁNIMO
    // ----------------------------------------------------
    socket.on('moodChanged', data => {
        const { sender, mood } = data;
        
        if (userStates[sender]) {
            userStates[sender].mood = mood;
        }

        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('moodChanged', {
                sender: sender,
                mood: mood
            });
            console.log(`Mood de ${sender} cambiado a ${mood}. Notificado a ${partnerName}.`);
        }
    });

    // ----------------------------------------------------
    // 3. SOLICITUD DE ESTADO DE LA PAREJA 
    // ----------------------------------------------------
    socket.on('requestPartnerStatus', data => {
        const targetUser = data.targetUser; 

        if (userStates[targetUser] && userStates[targetUser].socketId) {
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
    // 4. MANEJO DE PAUSA (statusChanged)
    // ----------------------------------------------------
    socket.on('chatPaused', data => {
        const sender = data.sender;
        
        if (userStates[sender]) {
            userStates[sender].status = 'paused';
        }
        
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];
        
        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('statusChanged', {
                sender: sender,
                status: 'paused'
            });
            console.log(`Chat pausado por ${sender}. Notificado a ${partnerName}.`);
        }
    });


    // ----------------------------------------------------
    // 5. MANEJO DE MENSAJES EN GENERAL (Se mantiene la lógica anterior)
    // ----------------------------------------------------
    socket.on("messageSent", (data) => {
        const receiverName = getPartnerName(data.sender);
        const receiverState = userStates[receiverName];

        if (receiverState && receiverState.socketId) {
            io.to(receiverState.socketId).emit("messageReceived", data);
            console.log(`Mensaje de ${data.sender} a ${receiverName} enviado.`);
        } else {
            console.log(`Mensaje de ${data.sender} a ${receiverName} NO ENTREGADO (Offline).`);
        }
    });

    // ----------------------------------------------------
    // 6. MANEJO DE LECTURA DE MENSAJES
    // ----------------------------------------------------
    socket.on("messagesRead", (data) => {
        const readerName = data.reader; 
        const receiverName = getPartnerName(readerName); 
        const receiverState = userStates[receiverName];

        if (receiverState && receiverState.socketId) {
            io.to(receiverState.socketId).emit("messagesMarkedRead", data);
            console.log(`Mensajes en ${data.chatId} leídos por ${readerName}. Notificado a ${receiverName}.`);
        }
    });

    // ----------------------------------------------------
    // 7. MANEJO DE MARCAR IMPORTANTE
    // ----------------------------------------------------
    socket.on("markImportant", (data) => {
        const markerName = data.marker;
        const receiverName = getPartnerName(markerName);
        const receiverState = userStates[receiverName];
        
        if (receiverState && receiverState.socketId) {
            io.to(receiverState.socketId).emit("importantMarked", {
                sender: markerName, 
                status: 'important' 
            });
            console.log(`Mensaje ${data.messageId} en ${data.chatId} marcado como importante por ${markerName}. Notificado a ${receiverName}.`);
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

            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("statusChanged", {
                    sender: userName,
                    status: 'offline'
                });
            }
            
            userStates[userName].status = 'offline';
            delete userStates[userName].socketId; 
            
            console.log(`Usuario desconectado: ${userName}`);
        } else {
            console.log("Usuario desconectado (no registrado):", socket.id);
        }
    });
    // ----------------------------------------------------
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));