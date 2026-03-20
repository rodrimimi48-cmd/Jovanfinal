// ============================
// script.js — ARK
// ============================
const API_BASE = window.location.origin;

async function enviarCodigo() {
  const email = prompt("Ingresa tu correo:");
  if (!email) return alert("Debes ingresar un correo.");

  const r = await fetch(`${API_BASE}/enviar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await r.json();
  if (!r.ok) return alert("Error: " + data.error);

  alert("Código enviado.");
}

async function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");

  msg.innerText = "Verificando...";

  const r = await fetch(`${API_BASE}/verificar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo })
  });

  const data = await r.json();
  if (!r.ok) {
    msg.style.color = "red";
    msg.innerText = data.error;
  } else {
    msg.style.color = "green";
    msg.innerText = "Código correcto ✔️";
  }
}

window.enviarCodigo = enviarCodigo;
window.verificarCodigo = verificarCodigo;