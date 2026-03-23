// pdf.js – PDF compatible con Node 25 + Render
// Genera un ticket en PDF usando HTML → PDF, sin binarios nativos

const pdf = require("html-pdf-node");

// Convierte centavos a dinero
function money(n, currency = "MXN", locale = "es-MX") {
  const val = Number(n || 0) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(val);
}

// Fecha formateada
function formatDate(d = new Date(), locale = "es-MX") {
  return new Date(d).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

/**
 * Generar PDF desde HTML (compatible Render + Node 25)
 */
async function generateReceiptPDF({ session, lineItems, ivaRate = 0.16, seller = {} }) {
  const currency = (session?.currency || "mxn").toUpperCase();
  const buyer = session?.customer_details?.email || session?.customer_email || "";
  const sessionId = session?.id || "";
  const createdAt = session?.created ? new Date(session.created * 1000) : new Date();

  const items = Array.isArray(lineItems) ? lineItems : [];

  let subtotalCents = 0;

  const rows = items.map((it) => {
    const qty = Number(it.quantity || 1);
    const desc = it.description || "Artículo";
    const unitCents = it?.price?.unit_amount ?? Math.round((it.amount_total || 0) / qty);
    const subtotal = it.amount_subtotal ?? unitCents * qty;
    subtotalCents += subtotal;

    return {
      qty,
      desc,
      unitCents,
      subtotal,
    };
  });

  const ivaCents = Math.round(subtotalCents * ivaRate);
  const totalCents = subtotalCents + ivaCents;

  const html = `
  <html>
  <body style="font-family: Arial; padding: 20px;">
  
    <h1>${seller.name || "ARK"}</h1>
    ${seller.taxId ? `<p>RFC: ${seller.taxId}</p>` : ""}
    ${seller.address ? `<p>${seller.address}</p>` : ""}
    ${seller.email ? `<p>Contacto: ${seller.email}</p>` : ""}
    <hr/>

    <h2>Comprobante de compra</h2>
    <p><b>Folio:</b> ${sessionId}</p>
    <p><b>Fecha:</b> ${formatDate(createdAt)}</p>
    <p><b>Cliente:</b> ${buyer}</p>

    <h3>Detalle</h3>
    <table width="100%" border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse;">
      <tr style="background:#eee;">
        <th align="left">Descripción</th>
        <th>Cant.</th>
        <th>P. Unit</th>
        <th>Importe</th>
      </tr>
      ${rows
        .map(
          (r) => `
        <tr>
          <td>${r.desc}</td>
          <td align="center">${r.qty}</td>
          <td align="right">${money(r.unitCents, currency)}</td>
          <td align="right">${money(r.subtotal, currency)}</td>
        </tr>
      `
        )
        .join("")}
    </table>

    <h3 style="margin-top:20px;">Totales</h3>
    <p><b>Subtotal:</b> ${money(subtotalCents, currency)}</p>
    <p><b>IVA ${ivaRate * 100}%:</b> ${money(ivaCents, currency)}</p>
    <p style="font-size:18px;"><b>Total:</b> ${money(totalCents, currency)}</p>

    <hr/>
    <p style="color:#777; font-size:12px;">
      Gracias por tu compra. Este documento no es factura fiscal.
    </p>

  </body>
  </html>
  `;

  // Opciones PDF
  const options = { format: "A4" };
  const file = { content: html };

  // Generar PDF como buffer
  const result = await pdf.generatePdf(file, options);
  return result;
}

module.exports = {
  generateReceiptPDF,
  money,
  formatDate,
};