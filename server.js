const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});
const path = require('path');

// Mapa para rastrear los IDs de socket por nombre de usuario.
const userSockets = {}; // Ejemplo: { "Leo": "socketId123", "Estefi": "socketId456" }
// 🔴 NUEVO: Mapa para rastrear el estado de pausa
const chatPaused = {
    Leo: null, // null o timestamp del fin de la pausa
    Estefi: null
};

// Servir archivos estáticos (CSS, JS del cliente, imágenes, etc.) desde la carpeta 'public'
app.use(express.static("public"));

// 1. RUTA RAÍZ (Página de Login)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. RUTA DEL CHAT (Página principal del chat)
app.get("/chat", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Conexión de clientes (Lógica de Socket.io)
io.on('connection', socket => {
    console.log("Usuario conectado:", socket.id);

    // ----------------------------------------------------
    // 1. REGISTRO DEL USUARIO AL CONECTARSE
    // ----------------------------------------------------
    socket.on('registerUser', (userName) => {
        // Asocia el ID del socket al nombre de usuario
        userSockets[userName] = socket.id;
        socket.userName = userName; // Almacena el nombre en el socket para usarlo en 'disconnect'
        console.log(`Usuario registrado: ${userName} con ID: ${socket.id}`);

        const partnerName = userName === "Leo" ? "Estefi" : "Leo";
        const partnerSocketId = userSockets[partnerName];

        // 1. Notificar a todos que este usuario está ONLINE
        io.emit("statusChanged", {
            sender: userName,
            status: 'online'
        });

        // 2. Si el otro usuario ya está conectado, enviar su estado a este nuevo socket
        if (partnerSocketId) {
            socket.emit("statusChanged", {
                sender: partnerName,
                status: 'online'
            });
        }
        
        // 3. 🔴 Nuevo: Enviar el estado de pausa actual a ambos usuarios
        // Si el usuario registrado está pausado, notifica a ambos.
        if (chatPaused[userName] && chatPaused[userName] > Date.now()) {
            io.emit("chatPausedState", {
                pausedBy: userName,
                endTime: chatPaused[userName]
            });
        }
        // Si el compañero está pausado, notifica a ambos.
        if (chatPaused[partnerName] && chatPaused[partnerName] > Date.now()) {
            io.emit("chatPausedState", {
                pausedBy: partnerName,
                endTime: chatPaused[partnerName]
            });
        }
    });

    // ----------------------------------------------------
    // 2. MANEJO DE MENSAJES BASE
    // ----------------------------------------------------
    // Cuando un usuario manda un mensaje (el objeto data ahora incluye replyTo y important)
    socket.on("sendMessage", data => {
        io.emit("receiveMessage", data);
    });

    // Cuando un usuario cambia su estado emocional
    socket.on("updateMood", data => {
        io.emit("moodChanged", data);
    });

    // ----------------------------------------------------
    // 3. 🔴 NUEVO: MANEJO DEL ESTADO DE PAUSA
    // ----------------------------------------------------
    socket.on('pauseChat', ({ sender, durationMs }) => {
        const endTime = Date.now() + durationMs;
        chatPaused[sender] = endTime;

        console.log(`Chat pausado por ${sender} hasta ${new Date(endTime).toLocaleTimeString()}`);
        
        // Notificar a todos el estado de pausa y cuándo termina
        io.emit("chatPausedState", {
            pausedBy: sender,
            endTime: endTime
        });

        // Configurar un timeout para enviar el evento de 'chatUnpaused' cuando termine la pausa
        setTimeout(() => {
            // Solo si el estado no ha cambiado desde que se inició el temporizador
            if (chatPaused[sender] === endTime) {
                chatPaused[sender] = null; // Quitar la marca de pausa
                console.log(`Chat despausado: ${sender}`);
                io.emit("chatUnpaused", { user: sender });
            }
        }, durationMs);
    });
    
    // ----------------------------------------------------
    // 4. 🔴 NUEVO: CONFIRMACIÓN DE LECTURA
    // ----------------------------------------------------
    socket.on('messageRead', ({ messageId, receiver }) => {
        const partnerSocketId = userSockets[receiver];
        
        if (partnerSocketId) {
            // Envía el evento SOLO al socket del usuario que envió el mensaje (el que lo marca como "Leído")
            io.to(partnerSocketId).emit('updateMessageReadStatus', { 
                messageId: messageId, 
                read: true 
            });
            console.log(`Mensaje ${messageId} marcado como leído por ${socket.userName}. Notificado a ${receiver}.`);
        }
    });

    // ----------------------------------------------------
    // 5. 🔴 NUEVO: MARCAR MENSAJE COMO IMPORTANTE
    // ----------------------------------------------------
    socket.on('markImportant', ({ messageId, targetUser }) => {
        const partnerSocketId = userSockets[targetUser];
        
        if (partnerSocketId) {
            // Envía el evento SOLO al compañero (el que recibió el mensaje)
            io.to(partnerSocketId).emit('messageMarkedImportant', {
                messageId: messageId,
                important: true 
            });
            console.log(`Mensaje ${messageId} marcado como importante por ${socket.userName}. Notificado a ${targetUser}.`);
        }
    });

    // ----------------------------------------------------
    // 6. MANEJO DE DESCONEXIÓN (OFFLINE)
    // ----------------------------------------------------
    socket.on("disconnect", () => {
        const userName = socket.userName;
        
        if (userName) {
            // Eliminar de nuestro mapa de usuarios activos
            delete userSockets[userName];
            
            // Notificar a todos que este usuario se ha desconectado (OFFLINE)
            io.emit("statusChanged", {
                sender: userName,
                status: 'offline' // ¡Esto es lo que necesita el app.js!
            });
            console.log(`Usuario desconectado: ${userName}`);
        } else {
            console.log("Usuario desconectado (no registrado):", socket.id);
        }
    });
    // ----------------------------------------------------
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));