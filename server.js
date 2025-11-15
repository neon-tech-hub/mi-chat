const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});
const path = require('path'); // 👈 LÍNEA AÑADIDA: Necesaria para trabajar con rutas de archivos

// Servir archivos estáticos (tu HTML, CSS y JS del chat)
app.use(express.static("public"));

// 1. RUTA PARA EL LOGIN (la ruta raíz '/')
app.get("/", (req, res) => {
    // Sirve el login.html al acceder a la raíz de la aplicación
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. RUTA PARA EL CHAT 
app.get("/chat", (req, res) => {
    // Sirve el index.html al acceder a /chat (asumiendo que es la interfaz del chat)
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Conexión de clientes
io.on('connection', socket => {
    console.log("Usuario conectado:", socket.id);

    // Cuando un usuario manda un mensaje
    socket.on("sendMessage", data => {
        // Lo envía a todos, incluyendo a la pareja
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