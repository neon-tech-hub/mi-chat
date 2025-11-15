const socket = io();

const PASSWORDS = { Leo: "12345678", Estefi: "87654321" };

const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const userInput = document.getElementById("userSelect");
const passInput = document.getElementById("passwordInput");

loginBtn.addEventListener("click", () => {
    const user = userInput.value.trim();
    const pass = passInput.value.trim();

    loginError.textContent = "";

    if (!user || !pass) {
        loginError.textContent = "Complete ambos campos.";
        return;
    }

    if (!PASSWORDS[user] || PASSWORDS[user] !== pass) {
        loginError.textContent = "Usuario o contraseña incorrecta.";
        return;
    }

    // Guardamos usuario en localStorage para usarlo luego en app principal
    localStorage.setItem("currentUser", user);

    // Avisamos estado online al servidor
    socket.emit("updateStatus", { user, online: true });

    // Redirigir al chat real (main)
    window.location.href = "/index.html";
});
