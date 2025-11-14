// =============================
// Estado Global
// =============================
let currentUser = null;
let currentChat = null;
let pauseActive = false;
let lastPause = 0;


let chats = {};
let userStates = { Leo: "", Estefi: "" };
let onlineStatus = { Leo: false, Estefi: false };


const BAD_WORDS = ["tonto", "idiota", "estupido", "feo"]; // Evitar fricción
const PASSWORDS = { Leo: "12345678", Estefi: "87654321" };


// =============================
// Referencias DOM
// =============================
const loginScreen = document.getElementById("loginScreen");
const mainScreen = document.getElementById("mainScreen");
const chatScreen = document.getElementById("chatScreen");


const userSelect = document.getElementById("userSelect");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");


const chatListDiv = document.getElementById("chatList");
const userStateSelect = document.getElementById("userStateSelect");


const chatPartner = document.getElementById("chatPartner");
const partnerStatus = document.getElementById("partnerStatus");


const messagesContainer = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const pauseBtn = document.getElementById("pauseBtn");
const backBtn = document.getElementById("backBtn");


const modal = document.getElementById("confirmModal");
const modalText = document.getElementById("modalText");
const modalYes = document.getElementById("modalYes");
const modalNo = document.getElementById("modalNo");


// =============================
// LocalStorage
// =============================
function saveData() {
    const data = {
        chats,
        userStates,
        onlineStatus
    };
    localStorage.setItem("chatData", JSON.stringify(data));
}

function loadData() {
    const saved = localStorage.getItem("chatData");
    if (saved) {
        const data = JSON.parse(saved);
        chats = data.chats || {};
        userStates = data.userStates || { Leo: "", Estefi: "" };
        onlineStatus = data.onlineStatus || { Leo: false, Estefi: false };
    }
}
