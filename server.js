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

// Stripe
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Mailer
let sendReceiptEmail = async () => {};
try {
  ({ sendReceiptEmail } = require("./mailer"));
} catch (e) {
  console.warn("[WARN] mailer no encontrado");
}

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "HEAD", "OPTIONS"]
  })
);

// =========================================================
// ⚠️ STRIPE WEBHOOK — DEBE IR ANTES DE express.json()
// =========================================================
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
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error("Error webhook:", err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        let lineItems = { data: [] };

        try {
          lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        } catch {}

        try {
          await sendReceiptEmail({
            session,
            lineItems: lineItems.data
          });
        } catch (e) {
          console.error("Error enviando ticket:", e);
        }
      }

      res.json({ received: true });
    } catch (e) {
      console.error("Webhook error:", e);
      res.status(200).end();
    }
  }
);

// =========================================================
// express.json DESPUÉS DEL WEBHOOK
// =========================================================
app.use(express.json());

// =========================================================
// ARCHIVOS ESTÁTICOS
// =========================================================
app.use(express.static(path.join(__dirname)));

// =========================================================
// RUTA PRINCIPAL
// =========================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Index.html"));
});

// =========================================================
// 2FA - ENVIAR CÓDIGO
// =========================================================
const activeCodes = {}; // memoria temporal

app.post("/enviar-codigo", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Falta email" });
    }

    // generar código 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000);

    // guardar en memoria 5 minutos
    activeCodes[email] = {
      code,
      expires: Date.now() + 5 * 60 * 1000
    };

    // enviar al correo
    await sendVerificationCode(email, code);

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error /enviar-codigo:", err);
    res.status(500).json({ error: "Error enviando código" });
  }
});

// =========================================================
// 2FA - VERIFICAR CÓDIGO
// =========================================================
app.post("/verificar-codigo", (req, res) => {
  try {
    const { codigo } = req.body;

    const emailEntry = Object.entries(activeCodes).find(
      ([_, data]) => data.code.toString() === codigo.toString()
    );

    if (!emailEntry) {
      return res.status(400).json({ error: "Código incorrecto" });
    }

    const [email, data] = emailEntry;

    // expirado?
    if (Date.now() > data.expires) {
      delete activeCodes[email];
      return res.status(400).json({ error: "Código expirado" });
    }

    // válido
    delete activeCodes[email];
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ Error /verificar-codigo:", err);
    res.status(500).json({ error: "Error verificando código" });
  }
});

// =========================================================
// IA (DINOSAURIOS) — Router API (MODELO GRATIS)
// =========================================================
app.post("/chat", async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta)
      return res.status(400).json({ error: "Falta pregunta" });

    if (!process.env.HF_API_KEY)
      return res.status(500).json({ error: "Falta HF_API_KEY" });

    const systemPrompt = `
Eres un paleontólogo experto.
Respondes únicamente acerca de dinosaurios.
Usa lenguaje educativo, claro y científico.
    `;

    const resp = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "meta-llama/Llama-3.2-1B-Instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: pregunta }
        ],
        max_tokens: 250,
        temperature: 0.5
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const respuesta =
      resp.data?.choices?.[0]?.message?.content?.trim() ||
      "No pude generar respuesta.";

    res.json({ respuesta });
  } catch (error) {
    console.error("🔥 ERROR IA:", error.response?.data || error.message);
    res.status(500).json({ error: "Error interno al procesar IA" });
  }
});

// =========================================================
// MAPBOX TOKEN
// =========================================================
app.get("/config/mapbox", (_req, res) => {
  const token = process.env.MAPBOX_PUBLIC_TOKEN || "";
  if (!token) {
    return res.status(500).json({
      mapboxToken: "",
      error: "MAPBOX_PUBLIC_TOKEN no configurado"
    });
  }
  res.json({ mapboxToken: token });
});

// =========================================================
// YOUTUBE
// =========================================================
app.get("/youtube", async (_req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY)
      return res.status(500).json({ error: "Falta YOUTUBE_API_KEY" });

    const r = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          q: "Animales prehistóricos documentales",
          type: "video",
          maxResults: 6,
          key: process.env.YOUTUBE_API_KEY
        }
      }
    );

    res.json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// FACEBOOK
// =========================================================
app.get("/facebook", async (_req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN)
      return res.status(500).json({ error: "Faltan credenciales FB" });

    const r = await axios.get(
      `https://graph.facebook.com/${process.env.FB_PAGE_ID}/posts`,
      {
        params: {
          fields: "message,permalink_url,created_time",
          access_token: process.env.FB_ACCESS_TOKEN
        }
      }
    );

    res.json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// S3 / R2 UPLOAD
// =========================================================
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ""
  }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${uuidv4()}${ext}`);
  }
});

const allowedVideoMimes = ["video/mp4", "video/webm", "video/ogg"];

const uploadVideo = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 },
  fileFilter: (_req, file, cb) => {
    if (!allowedVideoMimes.includes(file.mimetype))
      return cb(new Error("Formato inválido"));
    cb(null, true);
  }
});

app.post("/upload", uploadVideo.single("video"), async (req, res) => {
  const temp = req.file?.path;

  try {
    if (!process.env.S3_BUCKET)
      return res.status(500).json({ error: "Falta S3_BUCKET" });

    if (!req.file)
      return res.status(400).json({ error: "No file" });

    const key = `videos/${req.file.filename}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(temp),
        ContentType: req.file.mimetype
      })
    );

    fs.unlink(temp, () => {});
    res.json({ ok: true, key });
  } catch (err) {
    if (temp) fs.unlink(temp, () => {});
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// LIST VIDEOS
// =========================================================
app.get("/videos", async (_req, res) => {
  try {
    if (!process.env.S3_BUCKET)
      return res.status(500).json({ error: "Falta S3_BUCKET" });

    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: "videos/"
      })
    );

    const items = list.Contents || [];

    items.sort(
      (a, b) => new Date(b.LastModified) - new Date(a.LastModified)
    );

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
              Key: obj.Key }
            ),
            { expiresIn: 3600 }
          )
        }))
    );

    res.json({ videos: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// PUERTO
// =========================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo → http://localhost:${PORT}`);
});