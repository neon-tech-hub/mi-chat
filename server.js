const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});
const path = require('path'); // ✅ CORRECCIÓN 1: Se necesita para manejar rutas de archivos

// Servir archivos estáticos (CSS, JS del cliente, imágenes, etc.) desde la carpeta 'public'
app.use(express.static("public"));

// 1. RUTA RAÍZ (Página de Login)
app.get("/", (req, res) => {
    // Sirve el login.html cuando el usuario entra a http://localhost:3000/
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. RUTA DEL CHAT (Página principal del chat)
app.get("/chat", (req, res) => {
    // Sirve index.html, asumiendo que se accede después del login exitoso
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Conexión de clientes (Lógica de Socket.io)
io.on('connection', socket => {
    console.log("Usuario conectado:", socket.id);

    // Cuando un usuario manda un mensaje
    socket.on("sendMessage", data => {
        io.emit("receiveMessage", data);
    });

    // Cuando un usuario cambia su estado emocional
    socket.on("updateMood", data => {
        io.emit("moodChanged", data);
    });

    // Cuando un usuario cambia su estado de conexión
    socket.on("updateStatus", data => {
        io.emit("statusChanged", data);
    });

    socket.on("disconnect", () => {
        console.log("Usuario desconectado:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));