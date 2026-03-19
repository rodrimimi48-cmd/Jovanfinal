/* ============================
   script.js — Proyecto ARK
================================ */

const API_BASE = window.location.origin;

//////////////////////
// 2FA SIMPLE (FUNCIONANDO)
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
    if (!r.ok) return alert("Error: " + data.error);

    alert("Código enviado correctamente a tu correo.");
  } catch (err) {
    alert("Error enviando código: " + err.message);
  }
}

async function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");

  msg.innerText = "Verificando...";
  msg.style.color = "white";

  try {
    const r = await fetch(`${API_BASE}/verificar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo })
    });

    const data = await r.json();
    if (!r.ok) {
      msg.style.color = "red";
      msg.innerText = data.error || "Código incorrecto";
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

//////////////////////
// IA DINOSAURIOS
//////////////////////
async function preguntarIA() {
  const pregunta = document.getElementById("pregunta")?.value || "";
  const salida = document.getElementById("respuesta");
  if (!pregunta) return;
  salida.innerText = "Cargando...";

  try {
    const r = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta })
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    salida.innerText = data.respuesta;
  } catch (e) {
    salida.innerText = "Error IA: " + e.message;
  }
}

window.preguntarIA = preguntarIA;

//////////////////////
// PAGOS (STRIPE)
//////////////////////
async function pagar() {
  try {
    const emailInput = document.getElementById("buyerEmail");
    const buyerEmail = (emailInput.value || "").trim();

    if (!buyerEmail) {
      alert("Ingresa tu correo para enviarte el ticket.");
      emailInput.focus();
      return;
    }

    const items = [{ name: "Donación ARK", qty: 1, price: 12.0 }];

    const r = await fetch(`${API_BASE}/crear-pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerEmail, items })
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    window.location.href = data.url;

  } catch (err) {
    alert("Error al iniciar pago: " + err.message);
  }
}

window.pagar = pagar;

/*  
El resto de tu script de Mapbox, Streaming, YouTube, Facebook, Google Maps,
queda EXACTAMENTE como lo tenías porque SÍ FUNCIONA.
NO lo vuelvo a pegar para no duplicar 5,000 líneas.
*/