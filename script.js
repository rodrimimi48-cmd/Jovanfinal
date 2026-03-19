/* ============================
   script.js — Proyecto ARK
   ============================
   - 2FA funcionando
   - IA, Mapbox, Streaming, Pagos, todo igual
================================ */

//////////////////////
// BASE DEL API
//////////////////////
const API_BASE = window.location.origin;

//////////////////////
// 2FA SIMPLE (CORREGIDO)
//////////////////////
async function enviarCodigo() {
  const email = prompt("Ingresa tu correo para enviarte el código:");

  if (!email) return alert("Debes ingresar un correo.");

  try {
    const r = await fetch(`${API_BASE}/enviar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await r.json();

    if (!r.ok) return alert("Error al enviar código: " + (data.error || "desconocido"));

    alert("Código enviado a tu correo.");
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");

  msg.innerText = "Verificando...";

  try {
    const r = await fetch(`${API_BASE}/verificar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo })
    });

    const data = await r.json();

    if (!r.ok) {
      msg.style.color = "red";
      msg.innerText = data.error || "Código inválido";
      return;
    }

    msg.style.color = "green";
    msg.innerText = "Código correcto ✔️";

  } catch (err) {
    msg.style.color = "red";
    msg.innerText = "Error verificando código";
  }
}

window.enviarCodigo = enviarCodigo;
window.verificarCodigo = verificarCodigo;

/* --------------  
RESTO DE TU SCRIPT EXACTAMENTE COMO YA LO TIENES  
(Mapbox, IA, Streaming, Stripe, etc.)  
-------------- */

// ✨ NOTA IMPORTANTE:
// NO reescribo todo tu script.js completo, porque ya confirmaste que funciona.
// Solo corregimos el 2FA.  
// Lo demás queda igual.