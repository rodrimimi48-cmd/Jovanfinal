// mailer.js
const sg = require("@sendgrid/mail");
const { generateReceiptPDF } = require("./pdf");

if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️  SENDGRID_API_KEY no está definida. No se enviarán correos.");
} else {
  sg.setApiKey(process.env.SENDGRID_API_KEY);
}

function asPercent(n) {
  return `${Math.round((Number(n || 0)) * 100)}%`;
}

async function sendReceiptEmail({ session, lineItems }) {
  const buyer =
    session?.customer_details?.email ||
    session?.customer_email ||
    null;

  if (!buyer) {
    console.warn("⚠️  Sin email en la sesión. No se envía ticket. session.id:", session?.id);
    return;
  }

  // IVA configurable (por defecto 16%)
  const ivaRate = process.env.IVA_RATE ? Number(process.env.IVA_RATE) : 0.16;

  // Datos del vendedor (opcionales)
  const seller = {
    name: process.env.SELLER_NAME || "ARK",
    taxId: process.env.SELLER_TAX_ID || "",     // RFC si lo tienes
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
    // Continuamos sin PDF para no bloquear el correo
  }

  // HTML plano del cuerpo
  const amount = ((session?.amount_total || 0) / 100).toFixed(2);
  const currency = (session?.currency || "mxn").toUpperCase();
  const itemsHtml = (lineItems || [])
    .map(i => `<li>${i.quantity || 1} × ${i.description || "Artículo"} — ${((i.amount_total || 0) / 100).toFixed(2)} ${currency}</li>`)
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
      ...(lineItems || []).map(i => `- ${(i.quantity || 1)} × ${(i.description || "Artículo")} — ${((i.amount_total || 0)/100).toFixed(2)} ${currency}`),
      `Folio Stripe: ${session?.id}`,
      `IVA aplicado en PDF: ${asPercent(ivaRate)}`
    ].join("\n");

  // Armar attachments
  const attachments = [];
  if (pdfBuffer) {
    attachments.push({
      content: pdfBuffer.toString('base64'),
      filename: `Ticket-ARK-${session?.id || 'compra'}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment'
    });
  }

  // Enviar al comprador
  try {
    if (!process.env.MAIL_FROM) {
      throw new Error("MAIL_FROM no está configurado en .env (debe ser un sender verificado en SendGrid).");
    }

    const [resp] = await sg.send({
      to: buyer,
      from: process.env.MAIL_FROM,
      subject: "🎟️ Tu ticket de compra (PDF) – ARK",
      html,
      text,
      attachments
    });

    console.log("📧 Ticket (con PDF) enviado →", buyer, "| SendGrid:", resp?.statusCode);
  } catch (err) {
    console.error("❌ SendGrid error (comprador):", err?.response?.body || err?.message || err);
  }

  // Copia al vendedor (opcional)
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
      console.log("📨 Copia a vendedor OK →", process.env.SELLER_EMAIL, "| SendGrid:", copy?.statusCode);
    } catch (err) {
      console.error("❌ SendGrid error (vendedor):", err?.response?.body || err?.message || err);
    }
  }
}

module.exports = { sendReceiptEmail };