// mailer.js
const sg = require("@sendgrid/mail");
const { generateReceiptPDF } = require("./pdf");

// ===============================
// CONFIG SENDGRID
// ===============================
if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️  SENDGRID_API_KEY no está definida. No se enviarán correos.");
} else {
  sg.setApiKey(process.env.SENDGRID_API_KEY);
}

function asPercent(n) {
  return `${Math.round((Number(n || 0)) * 100)}%`;
}

// ===============================
// ENVÍO DEL TICKET DE COMPRA
// ===============================
async function sendReceiptEmail({ session, lineItems }) {
  const buyer =
    session?.customer_details?.email ||
    session?.customer_email ||
    null;

  if (!buyer) {
    console.warn("⚠️ Sin email del comprador, no se envía ticket.");
    return;
  }

  const ivaRate = process.env.IVA_RATE ? Number(process.env.IVA_RATE) : 0.16;

  const seller = {
    name: process.env.SELLER_NAME || "ARK",
    taxId: process.env.SELLER_TAX_ID || "",
    address: process.env.SELLER_ADDRESS || "",
    email: process.env.SELLER_EMAIL || process.env.MAIL_FROM
  };

  // Generar PDF
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateReceiptPDF({
      session,
      lineItems,
      ivaRate,
      seller
    });
  } catch (e) {
    console.error("❌ Error generando PDF:", e);
  }

  const amount = ((session?.amount_total || 0) / 100).toFixed(2);
  const currency = (session?.currency || "mxn").toUpperCase();

  const itemsHtml = (lineItems || [])
    .map(
      i => `<li>${i.quantity || 1} × ${i.description || "Artículo"} — ${(
        (i.amount_total || 0) / 100
      ).toFixed(2)} ${currency}</li>`
    )
    .join("");

  const html = `
    <h2>Gracias por tu compra</h2>
    <p>Tu pago fue procesado correctamente.</p>
    <p><b>Total cobrado (Stripe):</b> ${amount} ${currency}</p>
    <h3>Detalles:</h3>
    <ul>${itemsHtml}</ul>
    <p><b>Folio Stripe:</b> ${session?.id}</p>
    <p>Adjuntamos tu ticket en PDF con desglose de IVA.</p>
  `;

  const text =
    [
      "Gracias por tu compra",
      `Total cobrado (Stripe): ${amount} ${currency}`,
      "Detalles:",
      ...(lineItems || []).map(
        i =>
          `- ${i.quantity || 1} × ${i.description || "Artículo"} — ${(
            (i.amount_total || 0) / 100
          ).toFixed(2)} ${currency}`
      ),
      `Folio Stripe: ${session?.id}`,
      `IVA aplicado en PDF: ${asPercent(ivaRate)}`
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

  // ======== Enviar al comprador ========
  try {
    const [resp] = await sg.send({
      to: buyer,
      from: process.env.MAIL_FROM,
      subject: "🎟️ Tu ticket de compra (PDF) – ARK",
      html,
      text,
      attachments
    });

    console.log("📧 Ticket enviado →", buyer, "| SendGrid:", resp?.statusCode);
  } catch (err) {
    console.error("❌ Error SendGrid comprador:", err?.response?.body || err);
  }

  // ======== Copia vendedor ========
  if (process.env.SELLER_EMAIL) {
    try {
      const [copy] = await sg.send({
        to: process.env.SELLER_EMAIL,
        from: process.env.MAIL_FROM,
        subject: "🛒 Nueva compra ARK (PDF adjunto)",
        html,
        text,
        attachments
      });
      console.log("📨 Copia vendedor enviada →", process.env.SELLER_EMAIL);
    } catch (err) {
      console.error("❌ Error SendGrid vendedor:", err?.response?.body || err);
    }
  }
}

// ===============================
// 2FA — ENVÍO DEL CÓDIGO
// ===============================
async function sendVerificationCode(email, code) {
  if (!process.env.MAIL_FROM) {
    throw new Error("MAIL_FROM no está configurado en .env");
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .code { 
          font-size: 32px; 
          font-weight: bold; 
          background: #f0f0f0; 
          padding: 20px; 
          text-align: center;
          letter-spacing: 5px;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🔐 Tu código de verificación ARK</h2>
        <p>Este es tu código para verificar tu identidad:</p>
        <div class="code">${code}</div>
        <p>Es válido por <strong>10 minutos</strong>.</p>
        <p>Si no solicitaste este código, ignora este mensaje.</p>
      </div>
    </body>
    </html>
  `;

  const text = `Tu código de verificación ARK es: ${code}\n\nEste código expirará en 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`;

  try {
    const [resp] = await sg.send({
      to: email,
      from: process.env.MAIL_FROM,
      subject: "🔐 Código de verificación ARK",
      html,
      text
    });

    console.log(`📩 Código 2FA enviado → ${email} | Código: ${code}`);
    return resp;
  } catch (err) {
    console.error("❌ Error enviando código 2FA:", err?.response?.body || err);
    throw err;
  }
}

module.exports = {
  sendReceiptEmail,
  sendVerificationCode
};