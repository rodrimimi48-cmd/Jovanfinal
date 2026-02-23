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

const app = express();

////////////////////////////////////////////////////
// MIDDLEWARES
////////////////////////////////////////////////////
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

////////////////////////////////////////////////////
// LOG DE VARIABLES
////////////////////////////////////////////////////
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
console.log("BASE_URL:", process.env.BASE_URL || "❌ Vacía");
console.log("CHAT_TOPIC:", process.env.CHAT_TOPIC || "❌ Vacía (usa 'dinosaurios' por defecto)");
console.log("CHAT_TOPIC_KEYWORDS:", process.env.CHAT_TOPIC_KEYWORDS || "❌ Vacía");
console.log("=================================");

////////////////////////////////////////////////////
// RUTA PRINCIPAL
////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

////////////////////////////////////////////////////
// === UTILIDADES: LÍMITE DE TEMA PARA CHAT ===
////////////////////////////////////////////////////
function parseKeywords(envValue) {
  return (envValue || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const DEFAULT_TOPIC = process.env.CHAT_TOPIC || "dinosaurios";
const DEFAULT_KEYWORDS = parseKeywords(
  process.env.CHAT_TOPIC_KEYWORDS ||
    "dinosaurio,triásico,jurásico,cretácico,velociraptor,tyrannosaurus,rex,paleontología,fósil,prehistoria"
);

// Filtro básico por keywords para evitar llamadas off-topic
function isOnTopicBasic(question, keywords = DEFAULT_KEYWORDS) {
  if (!question) return false;
  const q = question.toLowerCase();
  if (!keywords || keywords.length === 0) {
    // Si no configuras keywords, no bloqueamos por este filtro
    return true;
  }
  return keywords.some((kw) => q.includes(kw));
}

////////////////////////////////////////////////////
// CHAT IA (HUGGING FACE) — CON LÍMITE DE TEMA
////////////////////////////////////////////////////
app.post("/chat", async (req, res) => {
  try {
    if (!process.env.HF_API_KEY) {
      return res.status(500).json({ error: "HF_API_KEY no configurada en el servidor" });
    }

    const { pregunta, topic: topicFromBody, keywords: keywordsFromBody } = req.body || {};
    const topicFromQuery = req.query?.topic;

    // Tema permitido (puede venir por body, query o .env)
    const allowedTopic = String(
      topicFromBody || topicFromQuery || process.env.CHAT_TOPIC || "dinosaurios"
    );

    // Keywords (si vienen por body como array, se usan; si no, las de .env)
    const topicKeywords = Array.isArray(keywordsFromBody)
      ? keywordsFromBody.map((s) => String(s).toLowerCase())
      : DEFAULT_KEYWORDS;

    if (!pregunta) {
      return res.status(400).json({ error: "La pregunta es obligatoria" });
    }

    // 1) Validación previa para ahorrar tokens si es off-topic
    const onTopic = isOnTopicBasic(pregunta, topicKeywords);
    if (!onTopic) {
      return res.status(400).json({
        error: `La pregunta no está dentro del tema permitido: "${allowedTopic}".`,
        detalle: "Reformula tu pregunta para que esté relacionada con el tema.",
        tema: allowedTopic,
      });
    }

    // 2) Prompt del sistema duro: el modelo también debe negarse si detecta off-topic sutil
    const systemPrompt = [
      `Eres un experto en ${allowedTopic}.`,
      `Reglas estrictas:`,
      `1) Solo puedes hablar de temas estrictamente relacionados con "${allowedTopic}".`,
      `2) Si la pregunta no está relacionada, responde con una breve negativa y sugiere cómo reformularla para que encaje en el tema.`,
      `3) Sé claro, conciso y profesional.`,
    ].join(" ");

    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Pregunta del usuario (tema: ${allowedTopic}): ${pregunta}` },
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
    res.json({ respuesta: texto, tema: allowedTopic });
  } catch (error) {
    console.error("🔥 ERROR HUGGING FACE:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error || error.message });
  }
});

////////////////////////////////////////////////////
// YOUTUBE API
////////////////////////////////////////////////////
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

////////////////////////////////////////////////////
// FACEBOOK GRAPH API
////////////////////////////////////////////////////
app.get("/facebook", async (req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Credenciales de Facebook no configuradas" });
    }

    // ⚠️ Si FB_PAGE_ID es de un grupo, /posts no funciona con la Graph API actual.
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

////////////////////////////////////////////////////
// === STREAMING APP === S3 CLIENT (Cloudflare R2)
////////////////////////////////////////////////////
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || !!process.env.S3_ENDPOINT, // R2/B2 requieren path-style
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

// Multer → disco temporal (no RAM), + filtro MIME
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

////////////////////////////////////////////////////
// SUBIR VIDEO (stream a R2)
////////////////////////////////////////////////////
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
      // ⚠️ R2 no usa ACLs; se maneja por credenciales/políticas
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

////////////////////////////////////////////////////
// LISTAR VIDEOS + URLS prefirmadas (1 hora)
////////////////////////////////////////////////////
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

    // Ordena más recientes primero (opcional, mejora UX del "featured")
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

////////////////////////////////////////////////////
// PAGOS — Stripe Checkout (la opción más rápida)
////////////////////////////////////////////////////
app.post("/crear-pago", async (req, res) => {
  try {
    if (!stripe || !process.env.BASE_URL) {
      return res.status(500).json({ error: "Stripe no configurado (STRIPE_SECRET_KEY/BASE_URL)" });
    }

    // ⚙️ Ajusta el monto, concepto y moneda a lo que quieras cobrar
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: "Donación ARK" },
            unit_amount: 5000, // 50.00 MXN (centavos)
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL}/?pago=ok`,
      cancel_url: `${process.env.BASE_URL}/?pago=cancelado`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Error Stripe:", err.message);
    return res.status(500).json({ error: "No se pudo crear el pago" });
  }
});

////////////////////////////////////////////////////
// INICIAR SERVIDOR
////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});