const sg = require("@sendgrid/mail");
const { generateReceiptPDF } = require("./pdf");

if (process.env.SENDGRID_API_KEY) {
  sg.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("SENDGRID_API_KEY no definida.");
}

function asPercent(n) {
  return `${Math.round((Number(n || 0)) * 100)}%`;
}

// ===============================
// TICKET (Stripe)
// ===============================
async function sendReceiptEmail({ session, lineItems }) {
  const buyer =
    session?.customer_details?.email ||
    session?.customer_email;

  if (!buyer) return;

  const ivaRate = Number(process.env.IVA_RATE || 0.16);

  let pdfBuffer;
  try {
    pdfBuffer = await generateReceiptPDF({
      session,
      lineItems,
      ivaRate,
      seller: {
        name: process.env.SELLER_NAME || "ARK",
        taxId: process.env.SELLER_TAX_ID || "",
        address: process.env.SELLER_ADDRESS || "",
        email: process.env.SELLER_EMAIL || process.env.MAIL_FROM
      }
    });
  } catch (e) {}

  const amount = ((session.amount_total || 0) / 100).toFixed(2);
  const currency = (session.currency || "mxn").toUpperCase();

  const html = `
    <h2>Gracias por tu compra</h2>
    <p>Total cobrado: ${amount} ${currency}</p>
    <p>Adjuntamos tu ticket en PDF.</p>
  `;

  const attachments = pdfBuffer
    ? [{
        content: pdfBuffer.toString("base64"),
        filename: `Ticket-ARK-${session.id}.pdf`,
        type: "application/pdf",
        disposition: "attachment"
      }]
    : [];

  await sg.send({
    to: buyer,
    from: process.env.MAIL_FROM,
    subject: "🎟️ Tu ticket ARK",
    html,
    text: html,
    attachments
  });
}

// ===============================
// 2FA — ENVÍO DEL CÓDIGO
// ===============================
async function sendVerificationCode(email, code) {
  const html = `
    <h2>Tu código de verificación</h2>
    <p>Este es tu código:</p>
    <h1>${code}</h1>
    <p>Válido 5 minutos.</p>
  `;

  await sg.send({
    to: email,
    from: process.env.MAIL_FROM,
    subject: "🔐 Código de verificación ARK",
    html,
    text: `Tu código es: ${code}`
  });
}

module.exports = {
  sendReceiptEmail,
  sendVerificationCode
};