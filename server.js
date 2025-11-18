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
// ✅ CORRECCIÓN CLAVE: Almacenamiento de estado completo de usuarios
// Ejemplo: { "Leo": { socketId: "...", mood: "😴", status: "online" } }
// =======================================================
const userStates = {}; 

// Función de utilidad para obtener el compañero
const getPartnerName = (userName) => (userName === "Leo" ? "Estefi" : "Leo");

// Servir archivos estáticos (CSS, JS del cliente, imágenes, etc.) desde la carpeta 'public'
app.use(express.static("public"));

// 1. RUTA RAÍZ (Página de Login)
app.get("/", (req, res) => {
    // Asumiendo que 'login.html' está directamente en la raíz o en 'public' si la app.use es correcta
    res.sendFile(path.join(__dirname, 'login.html')); 
});

// 2. RUTA DEL CHAT (Página principal del menú)
app.get("/menu", (req, res) => {
    // Asumiendo que el archivo de menú se llama index.html (como has estado trabajando)
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. RUTA DE LA CONVERSACIÓN
app.get("/chat", (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});


// Conexión de clientes (Lógica de Socket.io)
io.on('connection', socket => {
    console.log("Usuario conectado:", socket.id);

    // ----------------------------------------------------
    // 1. REGISTRO DEL USUARIO AL CONECTARSE
    // Recibe: { user: string, mood: string }
    // ----------------------------------------------------
    socket.on('userConnected', data => {
        const userName = data.user;
        const userMood = data.mood || '?'; 
        socket.userName = userName;

        // 1. Guardar o actualizar el estado completo del usuario
        userStates[userName] = {
            socketId: socket.id,
            mood: userMood,
            status: 'online'
        };
        
        // 2. Notificar a la pareja sobre el nuevo estado 'online'
        const partnerName = getPartnerName(userName);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
             // Enviar el cambio de estado de conexión a la pareja
            io.to(partnerState.socketId).emit('statusChanged', {
                sender: userName, 
                status: 'online' 
            });
        }
        
        console.log(`Usuario registrado: ${userName}. Mood: ${userMood}`);
    });

    // ----------------------------------------------------
    // 2. ✅ MANEJO DEL CAMBIO DE ÁNIMO (FIX PRINCIPAL)
    // Recibe: { sender: string, mood: string }
    // ----------------------------------------------------
    socket.on('moodChanged', data => {
        const { sender, mood } = data;
        
        // 1. Actualizar el estado en el servidor
        if (userStates[sender]) {
            userStates[sender].mood = mood;
        }

        // 2. Informar a la pareja
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
    // 3. SOLICITUD DE ESTADO DE LA PAREJA (Al cargar menu.html)
    // Recibe: { targetUser: string }
    // ----------------------------------------------------
    socket.on('requestPartnerStatus', data => {
        const targetUser = data.targetUser; // Este es el nombre de la pareja

        if (userStates[targetUser] && userStates[targetUser].socketId) {
            // La pareja está online/registrada, enviar su estado actual
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: userStates[targetUser].mood,
                status: userStates[targetUser].status 
            });
        } else {
            // La pareja está offline/desconocida
            socket.emit('partnerStatus', {
                user: targetUser,
                mood: '?', 
                status: 'offline'
            });
        }
    });

    // ----------------------------------------------------
    // 4. MANEJO DE PAUSA (statusChanged)
    // Recibe: { sender: string, duration: number }
    // ----------------------------------------------------
    socket.on('chatPaused', data => {
        const sender = data.sender;
        
        // 1. Actualizar el estado a 'paused'
        if (userStates[sender]) {
            userStates[sender].status = 'paused';
        }
        
        // 2. Notificar a la pareja el cambio de estado
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];
        
        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('statusChanged', {
                sender: sender,
                status: 'paused'
            });
            console.log(`Chat pausado por ${sender} por ${data.duration} minutos. Notificado a ${partnerName}.`);
        }
    });


    // ----------------------------------------------------
    // 5. MANEJO DE MENSAJES EN GENERAL (Se mantiene la lógica anterior)
    // ----------------------------------------------------
    socket.on("messageSent", (data) => {
        const receiverName = getPartnerName(data.sender);
        const receiverState = userStates[receiverName];

        if (receiverState && receiverState.socketId) {
            // Enviar solo si el compañero está conectado
            io.to(receiverState.socketId).emit("messageReceived", data);
            console.log(`Mensaje de ${data.sender} a ${receiverName} enviado.`);
        } else {
            // Manejar mensaje no entregado (por ejemplo, guardar en base de datos)
            console.log(`Mensaje de ${data.sender} a ${receiverName} NO ENTREGADO (Offline).`);
        }
    });

    // ----------------------------------------------------
    // 6. MANEJO DE LECTURA DE MENSAJES
    // ----------------------------------------------------
    socket.on("messagesRead", (data) => {
        const readerName = data.reader; // Quien leyó
        const receiverName = getPartnerName(readerName); // El remitente original
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
                sender: markerName, // Quién hizo la acción (el que marcó)
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
            // 1. Notificar a la pareja sobre el estado offline
            const partnerName = getPartnerName(userName);
            const partnerState = userStates[partnerName];

            if (partnerState && partnerState.socketId) {
                io.to(partnerState.socketId).emit("statusChanged", {
                    sender: userName,
                    status: 'offline'
                });
            }
            
            // 2. Actualizar el estado en el servidor: offline y sin socketId
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