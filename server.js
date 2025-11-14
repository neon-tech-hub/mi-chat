const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});

// Servir archivos estáticos (tu HTML, CSS y JS del chat)
app.use(express.static("public"));

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

const PORT = process.env.PORT || 3000;http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
