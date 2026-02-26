require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

// === STREAMING APP ===
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

// === PAGOS (Stripe Checkout) ===
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// === CORREO (SendGrid) ===
const { sendReceiptEmail } = require("./mailer");

const app = express();
app.set("trust proxy", 1); // Render/Proxies

// ================================
// Utils
// ================================
function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

// ================================
// LOG DE VARIABLES
// ================================
console.log("===== VARIABLES DE ENTORNO =====");
console.log("HF:", process.env.HF_API_KEY ? "✅ Cargada" : "❌ No cargada");
console.log("YOUTUBE:", process.env.YOUTUBE_API_KEY ? "✅ Cargada" : "❌ No cargada");
console.log("FB_PAGE_ID:", process.env.FB_PAGE_ID ? "✅ Cargada" : "❌ No cargada");
console.log("FB_ACCESS_TOKEN:", process.env.FB_ACCESS_TOKEN ? "✅ Cargada" : "❌ No cargada");
console.log("S3_BUCKET:", process.env.S3_BUCKET ? "✅ Cargada" : "❌ No cargada");
console.log("S3_REGION:", process.env.S3_REGION || "❌ Vacía");
console.log("S3_ENDPOINT:", process.env.S3_ENDPOINT ? "✅ Cargada" : "❌ No cargada");
console.log("S3_FORCE_PATH_STYLE:", process.env.S3_FORCE_PATH_STYLE || "❌ Vacía");
console.log("STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? "✅ Cargada" : "❌ No cargada");
console.log("STRIPE_WEBHOOK_SECRET:", process.env.STRIPE_WEBHOOK_SECRET ? "✅ Cargada" : "❌ No cargada");
console.log("BASE_URL:", process.env.BASE_URL || "❌ Vacía (se autodetectará)");
console.log("SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY ? "✅ Cargada" : "❌ No cargada");
console.log("MAIL_FROM:", process.env.MAIL_FROM ? "✅ Cargada" : "❌ No cargada");
console.log("SELLER_EMAIL:", process.env.SELLER_EMAIL ? "✅ Cargada" : "—");
console.log("=================================");

// ================================
// MIDDLEWARES (orden IMPORTANTE)
// ================================

// CORS amplio (por si pruebas frontend en otro origen)
app.use(
  cors({
    origin: true, // refleja el Origin que venga
    methods: ["GET", "POST", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Stripe-Signature"],
    credentials: false,
  })
);

// Estáticos (sirve index.html, script.js, style.css, imágenes, etc.)
app.use(express.static(path.join(__dirname)));

// Logging básico de requests
app.use((req, _res, next) => {
  console.log(`➡️  ${req.method} ${req.url}`);
  next();
});

// === WEBHOOK DE STRIPE (raw body) ===
// ⚠️ Debe ir ANTES de app.use(express.json())
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe) return res.status(500).send("Stripe no configurado");
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error("❌ Falta STRIPE_WEBHOOK_SECRET");
        return res.status(500).send("Falta STRIPE_WEBHOOK_SECRET");
      }

      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body, // cuerpo crudo (Buffer)
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error("❌ Firma inválida del webhook:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Obtener line items para el ticket
        let lineItems = { data: [] };
        try {
          lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        } catch (liErr) {
          console.error("⚠️ No se pudieron obtener line items:", liErr.message);
        }

        // Enviar correo (no bloquear respuesta a Stripe por errores de email)
        try {
          await sendReceiptEmail({ session, lineItems: lineItems.data });
          console.log(`📧 Ticket enviado a ${session?.customer_details?.email || "[sin email]"}`);
        } catch (mailErr) {
          console.error("Error enviando ticket:", mailErr.message);
        }
      }

      // Confirmar recepción a Stripe
      return res.json({ received: true });
    } catch (e) {
      console.error("🔥 Error en webhook:", e.message);
      // Responder 200 para evitar reintentos agresivos si algo inesperado ocurre
      return res.status(200).end();
    }
  }
);

// Ahora sí, parseo JSON para el resto de rutas
app.use(express.json());

// ================================
// HEALTH
// ================================
app.get("/health", (req, res) => {
  const detectedBase = getBaseUrl(req);
  res.json({
    ok: true,
    base_url_env: process.env.BASE_URL || null,
    base_url_detected: detectedBase,
    stripe: !!stripe,
  });
});

// ================================
// RUTA PRINCIPAL
// ================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================================
// CHAT IA (Hugging Face)
// ================================
app.post("/chat", async (req, res) => {
  try {
    if (!process.env.HF_API_KEY) {
      return res.status(500).json({ error: "HF_API_KEY no configurada en el servidor" });
    }

    const { pregunta } = req.body;
    if (!pregunta) return res.status(400).json({ error: "La pregunta es obligatoria" });

    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        messages: [
          { role: "system", content: "Eres un experto en dinosaurios. Responde claro y profesional." },
          { role: "user", content: `Pregunta: ${pregunta}` },
        ],
        max_tokens: 250,
        temperature: 0.7,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 60000,
      }
    );

    const texto = response.data?.choices?.[0]?.message?.content?.trim() || "Sin respuesta del modelo";
    res.json({ respuesta: texto });
  } catch (error) {
    console.error("🔥 ERROR HUGGING FACE:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error || error.message });
  }
});

// ================================
// YOUTUBE API
// ================================
app.get("/youtube", async (req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "YOUTUBE_API_KEY no configurada" });
    }

    const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: "Animales prehistóricos documentales",
        type: "video",
        maxResults: 6,
        key: process.env.YOUTUBE_API_KEY,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("🔥 ERROR YOUTUBE:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// ================================
// FACEBOOK GRAPH API
// ================================
app.get("/facebook", async (req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Credenciales de Facebook no configuradas" });
    }

    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.FB_PAGE_ID}/posts`,
      {
        params: {
          fields: "message,permalink_url,created_time",
          access_token: process.env.FB_ACCESS_TOKEN,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("🔥 ERROR FACEBOOK:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// ================================
// === STREAMING APP — S3 CLIENT (Cloudflare R2)
 // ================================
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || !!process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

// Multer → disco temporal + filtro MIME
const allowedMimes = ["video/mp4", "video/webm", "video/ogg"];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname).toLowerCase() ||
      `.${mime.extension(file.mimetype) || "mp4"}`;
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error("Solo se permiten videos MP4/WEBM/OGG."));
    }
    cb(null, true);
  },
});

// ================================
// SUBIR VIDEO (stream a R2)
// ================================
app.post("/upload", upload.single("video"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!process.env.S3_BUCKET) return res.status(500).json({ error: "S3_BUCKET no configurado" });
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo 'video'" });

    const contentType = req.file.mimetype;
    const key = `videos/${req.file.filename}`;

    const put = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fs.createReadStream(tempPath),
      ContentType: contentType,
    });

    const result = await s3.send(put);
    fs.unlink(tempPath, () => {});

    res.status(201).json({ ok: true, key, eTag: result.ETag || null });
  } catch (err) {
    if (tempPath) fs.unlink(tempPath, () => {});
    console.error("🔥 ERROR UPLOAD:", err?.name, err?.message, err?.$metadata || "");
    res.status(500).json({ error: err?.message || "Error subiendo el video" });
  }
});

// ================================
// LISTAR VIDEOS + URLS prefirmadas (1 hora)
// ================================
app.get("/videos", async (req, res) => {
  try {
    if (!process.env.S3_BUCKET) return res.status(500).json({ error: "S3_BUCKET no configurado" });

    const list = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: "videos/",
      MaxKeys: 100,
    });
    const out = await s3.send(list);
    const contents = out.Contents || [];

    contents.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

    const results = await Promise.all(
      contents
        .filter((obj) => obj.Key && !obj.Key.endsWith("/"))
        .map(async (obj) => {
          const get = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: obj.Key });
          const url = await getSignedUrl(s3, get, { expiresIn: 3600 }); // 1h
          return {
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
            url,
          };
        })
    );

    res.json({ videos: results });
  } catch (err) {
    console.error("🔥 ERROR VIDEOS:", err?.name, err?.message, err?.$metadata || "");
    res.status(500).json({ error: err?.message || "Error listando videos" });
  }
});

// ================================
// PAGOS — Stripe Checkout
// ================================
app.post("/crear-pago", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe no configurado (STRIPE_SECRET_KEY)" });
    }

    // BASE_URL: usa .env o auto-detecta desde la request
    const baseUrl = (process.env.BASE_URL && process.env.BASE_URL.trim().length > 0)
      ? process.env.BASE_URL
      : getBaseUrl(req);

    // Validación rápida de protocolo/host
    if (!/^https?:\/\//i.test(baseUrl)) {
      console.warn("⚠️ BASE_URL inválida o vacía. Detectada:", baseUrl);
    }
    console.log("🧭 BASE_URL usada para Stripe:", baseUrl);

    // Ajustado a $12.00 MXN
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: "Donación ARK" },
            unit_amount: 1200, // 12.00 MXN (centavos)
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/?pago=ok`,
      cancel_url: `${baseUrl}/?pago=cancelado`,
    });

    console.log("✅ Stripe session.url:", session.url);
    return res.json({ url: session.url });
  } catch (err) {
    console.error("🔥 Error Stripe /crear-pago:", err?.message || err);
    return res.status(500).json({ error: err?.message || "No se pudo crear el pago" });
  }
});

// ================================
// INICIAR SERVIDOR
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});