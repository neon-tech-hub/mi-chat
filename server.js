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

// Función de utilidad para obtener el compañero
const getPartnerName = (userName) => (userName === "Leo" ? "Estefi" : "Leo");

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

        const partnerName = getPartnerName(userName);
        const partnerSocketId = userSockets[partnerName];

        // 1. Notificar al compañero (si está conectado) que este usuario está ONLINE
        if (partnerSocketId) {
            io.to(partnerSocketId).emit("statusChanged", {
                sender: userName,
                status: 'online'
            });

            // 2. Enviar el estado del compañero a este nuevo socket (si el compañero está online)
            socket.emit("statusChanged", {
                sender: partnerName,
                status: 'online'
            });
        }
    });

    // ----------------------------------------------------
    // 2. MANEJO DE MENSAJES BASE
    // ----------------------------------------------------
    // Cuando un usuario manda un mensaje (data incluye replyToId/Text, isImportant)
    socket.on("sendMessage", data => {
        const sender = data.sender;
        const partnerName = getPartnerName(sender);
        const partnerSocketId = userSockets[partnerName];

        // 1. Retransmitir el mensaje SOLO al compañero, si está conectado.
        if (partnerSocketId) {
            io.to(partnerSocketId).emit("receiveMessage", data);
            console.log(`Mensaje de ${sender} enviado a ${partnerName}.`);
        } else {
            console.log(`Mensaje de ${sender} no entregado inmediatamente, ${partnerName} está offline.`);
        }
        
        // El mensaje se añade localmente en el cliente que lo envió.
    });

    // Cuando un usuario cambia su estado emocional
    socket.on("updateMood", data => {
        const sender = data.sender;
        const partnerName = getPartnerName(sender);
        const partnerSocketId = userSockets[partnerName];
        
        // Retransmitir el estado SOLO al compañero.
        if (partnerSocketId) {
            io.to(partnerSocketId).emit("moodChanged", data);
            console.log(`Estado de ánimo de ${sender} actualizado a ${data.mood}. Notificado a ${partnerName}.`);
        }
    });

    // ----------------------------------------------------
    // 3. 🟢 CONFIRMACIÓN DE LECTURA ('messageRead')
    // ----------------------------------------------------
    socket.on('messageRead', (data) => {
        const readerName = socket.userName; // El usuario que LEYÓ el mensaje
        const senderName = getPartnerName(readerName); // El usuario que LO ENVIÓ originalmente
        const senderSocketId = userSockets[senderName];
        
        // Notificamos SOLO al remitente original (el que necesita el tic de "Leído")
        if (senderSocketId) {
            io.to(senderSocketId).emit('messageStatusUpdate', { 
                chatId: data.chatId,
                messageId: data.messageId, 
                sender: readerName, // Quién hizo la acción (el lector)
                status: 'read' 
            });
            console.log(`Mensaje ${data.messageId} en ${data.chatId} marcado como leído por ${readerName}. Notificado a ${senderName}.`);
        }
    });

    // ----------------------------------------------------
    // 4. 🟢 MARCAR MENSAJE COMO IMPORTANTE ('markImportant')
    // ----------------------------------------------------
    socket.on('markImportant', (data) => {
        const markerName = socket.userName; // El usuario que MARCO el mensaje (el que lo envió)
        const receiverName = getPartnerName(markerName); // El usuario que lo RECIBIÓ (el que necesita el resaltado)
        const receiverSocketId = userSockets[receiverName];
        
        // Notificamos SOLO al compañero (el destinatario) para que vea el resaltado y la alerta.
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('messageStatusUpdate', {
                chatId: data.chatId,
                messageId: data.messageId,
                sender: markerName, // Quién hizo la acción (el que marcó)
                status: 'important' 
            });
            console.log(`Mensaje ${data.messageId} en ${data.chatId} marcado como importante por ${markerName}. Notificado a ${receiverName}.`);
        }
    });

    // ----------------------------------------------------
    // 5. MANEJO DE DESCONEXIÓN (OFFLINE)
    // ----------------------------------------------------
    socket.on("disconnect", () => {
        const userName = socket.userName;
        
        if (userName) {
            // Eliminar de nuestro mapa de usuarios activos
            delete userSockets[userName];
            
            const partnerName = getPartnerName(userName);
            const partnerSocketId = userSockets[partnerName];

            // Notificar SOLO al compañero que este usuario se ha desconectado (OFFLINE)
            if (partnerSocketId) {
                io.to(partnerSocketId).emit("statusChanged", {
                    sender: userName,
                    status: 'offline'
                });
            }
            console.log(`Usuario desconectado: ${userName}`);
        } else {
            console.log("Usuario desconectado (no registrado):", socket.id);
        }
    });
    // ----------------------------------------------------
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));