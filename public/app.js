// =============================
}


chatListDiv.addEventListener("click", (e) => {
if (e.target.classList.contains("add-chat")) {
const d = new Date();
const key = `${String(d.getDate()).padStart(2, "0")}-${String(
d.getMonth() + 1
).padStart(2, "0")}`;


if (!chats[key]) chats[key] = [];


renderChatList();
openChat(key);
}
});


// =============================
// Abrir Chat
// =============================
function openChat(dateKey) {
if (!userStates[currentUser]) return alert("Seleccione un estado emocional.");


currentChat = dateKey;


mainScreen.classList.remove("active");
chatScreen.classList.add("active");


const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
chatPartner.textContent = pareja;
updatePartnerStatus();


renderMessages();
saveData();
}


function updatePartnerStatus() {
const pareja = currentUser === "Leo" ? "Estefi" : "Leo";
partnerStatus.textContent = onlineStatus[pareja]
? `En línea ${userStates[pareja]}`
: `Ausente ${userStates[pareja]}`;
}


// =============================
// Render mensajes
// =============================
function renderMessages() {
messagesContainer.innerHTML = "";
if (!currentChat) return;


chats[currentChat].forEach((msg) => {
const div = document.createElement("div");
div.className = `message ${msg.sender === currentUser ? "sent" : "received"}`;
div.textContent = msg.text;
messagesContainer.appendChild(div);
});


messagesContainer.s