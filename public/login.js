// =======================================================
// LÓGICA DE LOGIN
// Solo maneja la autenticación y la redirección
// =======================================================

// Contraseñas válidas
const PASSWORDS = {
    Leo: "12345678",
    Estefi: "87654321"
};

const loginBtn = document.getElementById("loginBtn");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

// Evento login
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

    // Guardado SOLO durante la sesión actual
    sessionStorage.setItem("currentUser", user);

    // 🟢 REDIRECCIÓN CLAVE: Ahora apunta a la nueva página principal
    window.location.href = "menu.html";
});

// Permitir Enter
[loginUser, loginPassword].forEach(input => {
    input.addEventListener("keypress", e => {
        if (e.key === "Enter") loginBtn.click();
    });
});