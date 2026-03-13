require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

// Streaming (Cloudflare R2)
const fs = require("fs");
const os = require("os");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime-types");

// Pagos Stripe
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Correo (opcional)
let sendReceiptEmail = async () => {};
try {
  ({ sendReceiptEmail } = require("./mailer"));
} catch (e) {
  console.warn("[WARN] mailer no encontrado, usando función vacía");
}

const app = express();
app.set("trust proxy", 1);

/* ------------------------- UTIL ------------------------- */
function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const host  = (req.headers["x-forwarded-host"]  || req.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

/* ------------------------- MIDDLEWARES ------------------------- */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Stripe-Signature"],
  })
);

// Estáticos (sirve index.html, script.js, style.css, etc.)
app.use(express.static(path.join(__dirname)));

// Logging simple
app.use((req, _res, next) => { console.log(`➡️ ${req.method} ${req.url}`); next(); });

/* ----------------------- STRIPE WEBHOOK ----------------------- */
// ⚠️ Debe ir ANTES de express.json()
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe) return res.status(500).send("Stripe no configurado");
      const sig = req.headers["stripe-signature"];
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error("❌ Firma inválida:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        let lineItems = { data: [] };
        try { lineItems = await stripe.checkout.sessions.listLineItems(session.id); }
        catch (err) { console.error("⚠️ Error listando line items:", err.message); }

        try {
          await sendReceiptEmail({ session, lineItems: lineItems.data });
          console.log("📧 Ticket enviado a:", session.customer_details?.email || session.customer_email);
        } catch (mailErr) {
          console.error("❌ Error enviando email:", mailErr.message);
        }
      }
      return res.json({ received: true });
    } catch (e) {
      console.error("🔥 Error Webhook:", e.message);
      return res.status(200).end();
    }
  }
);

// Ahora sí, JSON para el resto
app.use(express.json());

/* ------------------------- RUTAS BÁSICAS ------------------------- */
app.get("/health", (req, res) => {
  res.json({ ok: true, base_url: getBaseUrl(req), stripe: !!stripe });
});

app.get("/", (req, res) => {
  // Sirve el index en minúsculas (haz que el archivo se llame "index.html")
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ------------------------- IA ------------------------- */
app.post("/chat", async (req, res) => {
  try {
    if (!process.env.HF_API_KEY) return res.status(500).json({ error: "Falta HF_API_KEY" });
    const { pregunta } = req.body || {};
    if (!pregunta || typeof pregunta !== "string" || !pregunta.trim())
      return res.status(400).json({ error: "Falta pregunta" });

    const HF_CHAT_URL = "https://api-inference.huggingface.co/v1/chat/completions";
    const MODEL = "HuggingFaceH4/zephyr-7b-beta";

    const response = await axios.post(
      HF_CHAT_URL,
      {
        model: MODEL,
        messages: [
          { role: "system", content: "Eres experto en dinosaurios." },
          { role: "user", content: pregunta.trim() },
        ],
        max_tokens: 250,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const txt = response.data?.choices?.[0]?.message?.content?.trim();
    res.json({ respuesta: txt || "Sin respuesta" });
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error("HF error:", status, data || err.message);
    const safeMsg = (typeof data === "string" && data) || data?.error || err.message || "Error desconocido";
    res.status(500).json({ error: `HF: ${status || 500} ${safeMsg}` });
  }
});

/* ------------------------- YOUTUBE ------------------------- */
app.get("/youtube", async (_req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY)
      return res.status(500).json({ error: "Falta YOUTUBE_API_KEY" });

    const r = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: "Animales prehistóricos documentales",
        type: "video",
        maxResults: 6,
        key: process.env.YOUTUBE_API_KEY,
      },
      timeout: 15000,
    });
    res.json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------- FACEBOOK ------------------------- */
app.get("/facebook", async (_req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN)
      return res.status(500).json({ error: "Faltan credenciales FB" });

    const r = await axios.get(
      `https://graph.facebook.com/${process.env.FB_PAGE_ID}/posts`,
      {
        params: {
          fields: "message,permalink_url,created_time",
          access_token: process.env.FB_ACCESS_TOKEN,
        },
        timeout: 15000,
      }
    );
    res.json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   CLOUDFLARE R2 — CLIENTE S3 (VIDEOS)
============================================================ */
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

/* ------------------------- MULTER (disco temporal) ------------------------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${uuidv4()}${ext}`);
  },
});

/* ============================ VIDEOS ============================ */
const allowedVideoMimes = ["video/mp4", "video/webm", "video/ogg"];
const uploadVideo = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB
  fileFilter: (_req, file, cb) => {
    if (!allowedVideoMimes.includes(file.mimetype)) {
      return cb(new Error("Formato inválido (solo MP4/WEBM/OGG)."));
    }
    cb(null, true);
  },
});

app.post("/upload", uploadVideo.single("video"), async (req, res) => {
  const temp = req.file?.path;
  try {
    if (!process.env.S3_BUCKET)
      return res.status(500).json({ error: "Falta S3_BUCKET" });
    if (!req.file) return res.status(400).json({ error: "No file" });

    const key = `videos/${req.file.filename}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(temp),
        ContentType: req.file.mimetype,
      })
    );
    fs.unlink(temp, () => {});
    res.json({ ok: true, key });
  } catch (err) {
    if (temp) fs.unlink(temp, () => {});
    res.status(500).json({ error: err.message });
  }
});

app.get("/videos", async (_req, res) => {
  try {
    if (!process.env.S3_BUCKET)
      return res.status(500).json({ error: "Falta S3_BUCKET" });

    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: "videos/",
      })
    );
    const items = list.Contents || [];
    items.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

    const result = await Promise.all(
      items
        .filter((obj) => obj.Key && !obj.Key.endsWith("/"))
        .map(async (obj) => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          url: await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.S3_BUCKET,
              Key: obj.Key,
            }),
            { expiresIn: 3600 }
          ),
        }))
    );
    res.json({ videos: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   PAGOS STRIPE
============================================================ */
app.post("/crear-pago", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe no configurado" });

    const { buyerEmail } = req.body || {};
    const baseUrl = process.env.BASE_URL?.trim() || getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: "Donación ARK" },
            unit_amount: 1200,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/?pago=ok`,
      cancel_url: `${baseUrl}/?pago=cancelado`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------- DEBUG ENVÍO DE CORREO --------------------- */
app.post("/debug-send", async (req, res) => {
  try {
    const to = (req.body?.to || "").trim();
    if (!to) return res.status(400).json({ error: "Falta 'to' en body" });

    const fakeSession = {
      id: "debug_session_123",
      amount_total: 1200,
      currency: "mxn",
      customer_email: to,
      customer_details: { email: to },
      created: Math.floor(Date.now() / 1000)
    };
    const fakeItems = [
      { description: "Donación ARK", quantity: 1, amount_total: 1200, amount_subtotal: 1035, price: { unit_amount: 1200 } }
    ];

    await sendReceiptEmail({ session: fakeSession, lineItems: fakeItems });
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ /debug-send:", e);
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------- SERVIDOR ------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});