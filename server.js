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
// VARIABLES Y ESTADO DEL SERVIDOR (Fix de Sincronización)
// =======================================================
// Almacena el estado completo: socketId, mood y status (online/offline/paused).
const userStates = {}; 
const getPartnerName = (userName) => (userName === "Leo" ? "Estefi" : "Leo");

// ------------------------------------------------------------------
// ✅ 1. Archivos Estáticos: Esto permite que el navegador encuentre /menu.js, /chat.css, etc.
// ------------------------------------------------------------------
app.use(express.static("public")); 

// ------------------------------------------------------------------
// ✅ 2. Rutas HTML: Apuntan a los archivos dentro de la carpeta 'public'. (Fix de 'Not Found')
// ------------------------------------------------------------------

// RUTA RAÍZ (http://localhost:3000/ -> public/login.html)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html')); 
});

// RUTA DEL MENÚ (Solicitada como /menu.html -> public/menu.html)
app.get("/menu.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html')); 
});

// RUTA DE LA CONVERSACIÓN (Solicitada como /chat.html -> public/chat.html)
app.get("/chat.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});


// =======================================================
// LÓGICA DE SOCKET.IO (Sincronización de Estados y Chat)
// =======================================================
io.on('connection', socket => {
    console.log("Usuario conectado:", socket.id);

    // ----------------------------------------------------
    // 1. REGISTRO DEL USUARIO AL CONECTARSE
    // ----------------------------------------------------
    socket.on('userConnected', data => {
        const userName = data.user;
        const userMood = data.mood || '?'; 
        socket.userName = userName;

        // Guardar estado completo
        userStates[userName] = {
            socketId: socket.id,
            mood: userMood,
            status: 'online'
        };
        
        const partnerName = getPartnerName(userName);
        const partnerState = userStates[partnerName];

        // Notificar a la pareja que el usuario está ONLINE
        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('statusChanged', {
                sender: userName, 
                status: 'online' 
            });
        }
    });

    // ----------------------------------------------------
    // 2. ✅ MANEJO DEL CAMBIO DE ÁNIMO (FIX PRINCIPAL)
    // ----------------------------------------------------
    socket.on('moodChanged', data => {
        const { sender, mood } = data;
        
        // 1. Actualizar el estado en el servidor
        if (userStates[sender]) {
            userStates[sender].mood = mood;
        }

        // 2. Informar a la pareja sobre el nuevo ánimo
        const partnerName = getPartnerName(sender);
        const partnerState = userStates[partnerName];

        if (partnerState && partnerState.socketId) {
            io.to(partnerState.socketId).emit('moodChanged', {
                sender: sender,
                mood: mood
            });
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
    // 4. MANEJO DE DESCONEXIÓN (OFFLINE)
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
        }
    });
    
    // [Se mantienen los manejadores de chatPaused, messageSent, messagesRead, markImportant]
    // ... (asegúrate de mantener estos manejadores de tu código original)
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));