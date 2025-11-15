const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});
const path = require('path');

// 🔴 NUEVO: Mapa para rastrear los IDs de socket por nombre de usuario.
// Esto es esencial para saber quién se desconectó.
const userSockets = {}; // Ejemplo: { "Leo": "socketId123", "Estefi": "socketId456" }

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
    // 🔴 CAMBIO 1: REGISTRO DEL USUARIO AL CONECTARSE
    // El cliente debe enviar su nombre al conectarse.
    socket.on('registerUser', (userName) => {
        // Asocia el ID del socket al nombre de usuario
        userSockets[userName] = socket.id;
        socket.userName = userName; // Almacena el nombre en el socket para usarlo en 'disconnect'
        console.log(`Usuario registrado: ${userName} con ID: ${socket.id}`);

        // Determinar el nombre del otro usuario para enviarle el estado
        const partnerName = userName === "Leo" ? "Estefi" : "Leo";

        // 1. Notificar al otro usuario que este usuario está ONLINE
        io.emit("statusChanged", {
            sender: userName,
            status: 'online'
        });

        // 2. Si el otro usuario ya está conectado, enviar su estado a este nuevo socket
        if (userSockets[partnerName]) {
            socket.emit("statusChanged", {
                sender: partnerName,
                status: 'online'
            });
        }
    });
    // ----------------------------------------------------


    // Cuando un usuario manda un mensaje
    socket.on("sendMessage", data => {
        io.emit("receiveMessage", data);
    });

    // Cuando un usuario cambia su estado emocional
    socket.on("updateMood", data => {
        io.emit("moodChanged", data);
    });

    // 🔴 ELIMINADO: Esta línea ya no es necesaria, el registro y disconnect manejan el estado.
    // socket.on("updateStatus", data => {
    //     io.emit("statusChanged", data);
    // });


    // ----------------------------------------------------
    // 🔴 CAMBIO 2: MANEJO DE DESCONEXIÓN (OFFLINE)
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