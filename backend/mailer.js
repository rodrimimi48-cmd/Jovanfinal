// ======================================
// mailer.js — ARK Email System (SendGrid)
// ======================================

const sg = require("@sendgrid/mail");

// Configurar SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY no está definida. No se enviarán correos.");
} else {
  sg.setApiKey(process.env.SENDGRID_API_KEY);
}

// Utilidad para IVA
function asPercent(n) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

// ======================================
// Enviar Ticket PDF de Compra
// ======================================
async function sendReceiptEmail({ session, lineItems }) {
  const buyer =
    session?.customer_details?.email ||
    session?.customer_email ||
    null;

  if (!buyer) {
    console.warn("⚠️ Sin email del comprador → No se envía ticket.");
    return;
  }

  const ivaRate = process.env.IVA_RATE
    ? Number(process.env.IVA_RATE)
    : 0.16;

  // Generar PDF desde pdf.js
  let pdfBuffer = null;
  try {
    const { generateReceiptPDF } = require("./pdf");
    pdfBuffer = await generateReceiptPDF({
      session,
      lineItems,
      ivaRate
    });
  } catch (e) {
    console.error("❌ Error generando PDF:", e);
  }

  const amount = ((session?.amount_total || 0) / 100).toFixed(2);
  const currency = (session?.currency || "mxn").toUpperCase();

  // HTML limpio (SIN entidades escapadas)
  const itemsHtml = (lineItems || [])
    .map(i => `
      <li>${i.quantity || 1} × ${i.description || "Artículo"} — 
      ${((i.amount_total || 0) / 100).toFixed(2)} ${currency}</li>
    `)
    .join("");

  const html = `
    <h2>🎟️ Gracias por tu compra</h2>

    <p>Tu pago fue procesado correctamente.</p>
    <p><b>Total cobrado (Stripe):</b> ${amount} ${currency}</p>

    <h3>🛒 Detalles:</h3>
    <ul>${itemsHtml}</ul>

    <p><b>Folio Stripe:</b> ${session?.id}</p>

    <p>Adjuntamos tu ticket en PDF con el desglose de IVA (${asPercent(
      ivaRate
    )}).</p>

    <br>
    <p>Gracias por comprar en <b>ARK System</b>.</p>
  `;

  const text =
    [
      "Gracias por tu compra",
      `Total cobrado: ${amount} ${currency}`,
      "Detalles:",
      ...(lineItems || []).map(
        i =>
          `- ${i.quantity || 1} × ${i.description || "Artículo"} — ${
            (i.amount_total || 0) / 100
          } ${currency}`
      ),
      `Folio: ${session?.id}`,
      `IVA aplicado: ${asPercent(ivaRate)}`
    ].join("\n");

  const attachments = [];

  if (pdfBuffer) {
    attachments.push({
      content: pdfBuffer.toString("base64"),
      filename: `Ticket-ARK-${session?.id || "compra"}.pdf`,
      type: "application/pdf",
      disposition: "attachment"
    });
  }

  // Enviar email al comprador
  try {
    await sg.send({
      to: buyer,
      from: process.env.MAIL_FROM,
      subject: "🎟️ Tu ticket de compra (PDF) – ARK",
      html,
      text,
      attachments
    });

    console.log("📧 Ticket enviado →", buyer);
  } catch (err) {
    console.error("❌ Error enviando ticket:", err?.response?.body || err);
  }
}

// ======================================
// 2FA — Enviar código de verificación
// ======================================
async function sendVerificationCode(email, code) {
  if (!process.env.MAIL_FROM) {
    throw new Error("MAIL_FROM no está configurado en .env");
  }

  const html = `
    <h2>🔐 Tu código de verificación ARK</h2>
    <p>Este es tu código para verificar tu identidad:</p>
    <h1 style="font-size: 32px; color: #0ea5e9;">${code}</h1>
    <p>Es válido por <strong>10 minutos</strong>.</p>
    <p>Si no solicitaste este código, ignora este mensaje.</p>
  `;

  const text = `
  Tu código de verificación ARK es: ${code}
  Este código expirará en 10 minutos.
  Si no solicitaste este código, ignora este mensaje.
  `;

  try {
    await sg.send({
      to: email,
      from: process.env.MAIL_FROM,
      subject: "🔐 Código de verificación ARK",
      html,
      text
    });

    console.log(`📩 Código 2FA enviado a ${email}`);
  } catch (err) {
    console.error("❌ Error enviando código 2FA:", err?.response?.body || err);
    throw err;
  }
}

module.exports = {
  sendReceiptEmail,
  sendVerificationCode
};