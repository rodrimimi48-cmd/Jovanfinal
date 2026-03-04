// mailer.js
const sg = require("@sendgrid/mail");

if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️  SENDGRID_API_KEY no está definida. No se enviarán correos.");
} else {
  sg.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Envía ticket al comprador y copia opcional al vendedor.
 * @param {{ session: any, lineItems: Array }} params
 */
async function sendReceiptEmail({ session, lineItems }) {
  // 1) Determinar email del comprador (2 posibles fuentes)
  const buyer =
    session?.customer_details?.email ||
    session?.customer_email ||
    null;

  if (!buyer) {
    console.warn("⚠️  Sin email en la sesión. No se envía ticket. session.id:", session?.id);
    return;
  }

  // 2) Armar datos del ticket
  const amountTotal = Number(session?.amount_total || 0);
  const amount = (amountTotal / 100).toFixed(2);
  const currency = (session?.currency || "mxn").toUpperCase();

  const safeItems = Array.isArray(lineItems) ? lineItems : [];
  const itemsHtml = safeItems
    .map((i) => {
      const qty = i?.quantity ?? 1;
      const desc = i?.description || "Artículo";
      const total = Number(i?.amount_total || 0);
      return `<li>${qty} × ${desc} — ${(total / 100).toFixed(2)} ${currency}</li>`;
    })
    .join("");

  const html = `
    <h2>Gracias por tu compra</h2>
    <p>Tu pago fue procesado correctamente.</p>
    <p><b>Total:</b> ${amount} ${currency}</p>
    <h3>Detalles del ticket:</h3>
    <ul>${itemsHtml}</ul>
    <p><b>ID Stripe:</b> ${session?.id}</p>
  `;

  const text =
    [
      "Gracias por tu compra",
      `Total: ${amount} ${currency}`,
      "Detalles:",
      ...safeItems.map((i) => {
        const qty = i?.quantity ?? 1;
        const desc = i?.description || "Artículo";
        const total = Number(i?.amount_total || 0);
        return `- ${qty} × ${desc} — ${(total / 100).toFixed(2)} ${currency}`;
      }),
      `ID Stripe: ${session?.id}`,
    ].join("\n");

  // 3) Enviar al comprador
  try {
    if (!process.env.MAIL_FROM) {
      throw new Error("MAIL_FROM no está configurado en .env (debe ser un sender verificado en SendGrid).");
    }

    const [resp] = await sg.send({
      to: buyer,
      from: process.env.MAIL_FROM,
      subject: "🎟️ Tu ticket de compra – ARK",
      html,
      text,
      // Opcional: agrega reply-to si quieres recibir respuestas del cliente
      // replyTo: process.env.SELLER_EMAIL || process.env.MAIL_FROM,
    });

    console.log("📧 Ticket enviado al comprador →", buyer, "| SendGrid:", resp?.statusCode);
  } catch (err) {
    // Log detallado (si SendGrid responde con body de error lo imprimimos)
    const sgBody = err?.response?.body || err?.message || err;
    console.error("❌ Error enviando correo al comprador:", sgBody);
    // No lanzamos throw para no afectar el 200 del webhook ante Stripe.
  }

  // 4) Copia al vendedor (opcional)
  if (process.env.SELLER_EMAIL) {
    try {
      const [copy] = await sg.send({
        to: process.env.SELLER_EMAIL,
        from: process.env.MAIL_FROM,
        subject: "🛒 Nueva compra ARK",
        html,
        text,
      });
      console.log("📨 Copia a vendedor OK →", process.env.SELLER_EMAIL, "| SendGrid:", copy?.statusCode);
    } catch (err) {
      console.error("❌ Error enviando copia al vendedor:", err?.response?.body || err?.message || err);
    }
  }
}

module.exports = { sendReceiptEmail };