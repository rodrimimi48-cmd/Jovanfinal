// ======================
// server.js — ARK Backend
// ======================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ============== IMPORTAR MAILER (CORRECTO) ==============
let sendReceiptEmail = async () => {};
let sendVerificationCode = async () => {};

try {
  ({ sendReceiptEmail, sendVerificationCode } = require("./mailer"));
} catch (e) {
  console.warn("[WARN] mailer no encontrado");
}

const app = express();
app.set("trust proxy", 1);

app.use(cors({ origin: true, methods: ["GET","POST","HEAD","OPTIONS"] }));

// =========================
// STRIPE WEBHOOK
// =========================
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      let event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

        await sendReceiptEmail({
          session,
          lineItems: lineItems.data
        });
      }

      res.json({ received: true });
    } catch (err) {
      console.error(err);
      res.status(200).end();
    }
  }
);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =========================
// RUTA PRINCIPAL
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Index.html"));
});

// =========================
// 2FA — ENVIAR CÓDIGO
// =========================
const activeCodes = {};

app.post("/enviar-codigo", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Falta email" });

    const code = Math.floor(100000 + Math.random() * 900000);

    activeCodes[email] = {
      code,
      expires: Date.now() + 5 * 60 * 1000
    };

    await sendVerificationCode(email, code);

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ error: "Error enviando código" });
  }
});

// =========================
// 2FA — VERIFICAR CÓDIGO
// =========================
app.post("/verificar-codigo", (req, res) => {
  const { codigo } = req.body;

  const entry = Object.entries(activeCodes).find(
    ([email, data]) => data.code == codigo
  );

  if (!entry) return res.status(400).json({ error: "Código incorrecto" });

  const [email, data] = entry;

  if (Date.now() > data.expires) {
    delete activeCodes[email];
    return res.status(400).json({ error: "Código expirado" });
  }

  delete activeCodes[email];
  res.json({ ok: true });
});

// =========================
// IA
// =========================
app.post("/chat", async (req, res) => {
  try {
    const { pregunta } = req.body;

    const resp = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "meta-llama/Llama-3.2-1B-Instruct",
        messages: [
          { role: "system", content: "Eres un paleontólogo experto." },
          { role: "user", content: pregunta }
        ]
      },
      { headers: { Authorization:`Bearer ${process.env.HF_API_KEY}` } }
    );

    res.json({
      respuesta: resp.data?.choices?.[0]?.message?.content || "Sin respuesta"
    });

  } catch (e) {
    res.status(500).json({ error: "Error IA" });
  }
});

// =========================
// EL RESTO DE TUS ENDPOINTS (Mapbox, YouTube, Facebook, S3…)
// =========================

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Servidor ARK listo")
);