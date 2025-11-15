// Usuarios y contraseñas de ejemplo
const PASSWORDS = {
    Leo: "12345678",
    Estefi: "87654321"
};

const loginBtn = document.getElementById("loginBtn");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

loginBtn.addEventListener("click", () => {
    const user = loginUser.value.trim();
    const pass = loginPassword.value.trim();

    loginError.textContent = "";

    if (!user || !pass) {
        loginError.textContent = "Ingrese usuario y contraseña.";
        return;
    }

    if (!PASSWORDS[user] || PASSWORDS[user] !== pass) {
        loginError.textContent = "Usuario o contraseña incorrecta.";
        return;
    }

    // Guardamos usuario solo temporalmente en sessionStorage si lo deseamos
    sessionStorage.setItem("currentUser", user);

    // Redirigir al index.html
    window.location.href = "/index.html";
});
