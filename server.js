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
        
        // La lógica de pausa se maneja en el cliente (app.js) mediante un timer y almacenamiento local. 
        // No es estrictamente necesario emitir el estado de pausa aquí, 
        // pero si quieres que sea centralizado, se mantiene la estructura.
        // **Nota:** No había evento 'chatPausedState' en tu app.js, si lo necesitas, avísame.
    });

    // ----------------------------------------------------
    // 2. MANEJO DE MENSAJES BASE
    // ----------------------------------------------------
    // Cuando un usuario manda un mensaje (el objeto data ahora incluye replyTo y important)
    socket.on("sendMessage", data => {
        // Simplemente reenvía el mensaje a todos los sockets conectados.
        io.emit("receiveMessage", data);
    });

    // Cuando un usuario cambia su estado emocional
    socket.on("updateMood", data => {
        io.emit("moodChanged", data);
    });

    // ----------------------------------------------------
    // 3. 🔴 MANEJO DEL ESTADO DE PAUSA (NO NECESARIO EN ESTE CÓDIGO)
    // Se elimina el código de pausa ya que la lógica solo estaba en el cliente y 
    // tu app.js no tiene un receptor para 'pauseChat' y 'chatPausedState'.
    // La pausa es manejada LOCALMENTE por el temporizador en el app.js.
    // ----------------------------------------------------
    
    // ----------------------------------------------------
    // 4. 🟢 NUEVO: CONFIRMACIÓN DE LECTURA
    // ----------------------------------------------------
    socket.on('messageRead', (data) => {
        const sender = socket.userName;
        const partnerName = getPartnerName(sender);
        const partnerSocketId = userSockets[partnerName];
        
        // La data que llega es { chatId, messageId }.
        // El compañero es el REMITENTE original del mensaje (el que necesita saber que fue leído).
        if (partnerSocketId) {
            // Envía el evento SOLO al socket del usuario que envió el mensaje original.
            io.to(partnerSocketId).emit('messageStatusUpdate', { 
                chatId: data.chatId,
                messageId: data.messageId, 
                sender: sender, // El usuario que LO LEYÓ
                status: 'read' 
            });
            console.log(`Mensaje ${data.messageId} en ${data.chatId} marcado como leído por ${sender}. Notificado a ${partnerName}.`);
        }
    });

    // ----------------------------------------------------
    // 5. 🟢 NUEVO: MARCAR MENSAJE COMO IMPORTANTE
    // ----------------------------------------------------
    socket.on('markImportant', (data) => {
        const sender = socket.userName;
        const partnerName = getPartnerName(sender);
        const partnerSocketId = userSockets[partnerName];
        
        // La data que llega es { chatId, messageId }.
        // El compañero es el DESTINATARIO del mensaje original (el que necesita ver el resaltado).
        if (partnerSocketId) {
            // Envía el evento SOLO al compañero para que actualice su vista.
            io.to(partnerSocketId).emit('messageStatusUpdate', {
                chatId: data.chatId,
                messageId: data.messageId,
                sender: sender, // El usuario que LO MARCO
                status: 'important' 
            });
            console.log(`Mensaje ${data.messageId} en ${data.chatId} marcado como importante por ${sender}. Notificado a ${partnerName}.`);
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