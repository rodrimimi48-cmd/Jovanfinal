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
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// SQLite (better-sqlite3)
const Database = require("better-sqlite3");
const db = new Database(path.join(__dirname, "database.db"));

// Ejecutar init.sql
const initSQL = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
db.exec(initSQL);

// Mailer
const { sendReceiptEmail, sendVerificationCode } = require("./mailer");

// AWS S3 / Cloudflare R2
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

// Inicializar servidor
const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "HEAD", "OPTIONS"]
  })
);

// =========================================================
// ⚠️ STRIPE WEBHOOK — ANTES DE express.json()
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
          console.error("Error PDF:", e);
        }
      }

      res.json({ received: true });
    } catch (e) {
      res.status(200).end();
    }
  }
);

// =========================================================
// JSON NORMAL
// =========================================================
app.use(express.json());

// =========================================================
// RUTAS LOGIN + REGISTER + 2FA + JWT
// =========================================================

// Registrar usuario
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Faltan campos" });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(
      email,
      hash
    );
    return res.json({ success: true });
  } catch {
    return res.status(400).json({ error: "El usuario ya existe" });
  }
});

// Mapa temporal 2FA
const codes = new Map();

// LOGIN — Paso 1
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user)
      return res.status(400).json({ error: "Usuario no encontrado" });

    bcrypt.compare(password, user.password_hash).then((ok) => {
      if (!ok)
        return res.status(400).json({ error: "Contraseña incorrecta" });

      const code = Math.floor(100000 + Math.random() * 900000).toString();

      codes.set(email, {
        code,
        expires: Date.now() + 5 * 60 * 1000
      });

      sendVerificationCode(email, code).catch(() => {
        console.log("Código 2FA:", code);
      });

      return res.json({ step: "2FA" });
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// LOGIN — Paso 2
app.post("/verify-2fa", (req, res) => {
  const { email, code } = req.body;

  if (!codes.has(email))
    return res.status(400).json({ error: "Código no solicitado" });

  const data = codes.get(email);

  if (Date.now() > data.expires)
    return res.status(400).json({ error: "Código expirado" });

  if (data.code !== code)
    return res.status(400).json({ error: "Código incorrecto" });

  codes.delete(email);

  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "2h"
  });

  return res.json({ success: true, token });
});

// Middleware auth
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header)
    return res.status(401).json({ error: "Token requerido" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =========================================================
// IA DINOSAURIOS
// =========================================================
app.post("/chat", async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta)
      return res.status(400).json({ error: "Falta pregunta" });

    const resp = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "meta-llama/Llama-3.2-1B-Instruct",
        messages: [
          { role: "system", content: "Eres un paleontólogo experto." },
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

    res.json({ respuesta: resp.data?.choices?.[0]?.message?.content || "" });
  } catch {
    res.status(500).json({ error: "Error interno IA" });
  }
});

// =========================================================
// MAPBOX TOKEN
// =========================================================
app.get("/config/mapbox", (_req, res) => {
  const token = process.env.MAPBOX_PUBLIC_TOKEN || "";
  if (!token) return res.status(500).json({ error: "Falta MAPBOX_PUBLIC_TOKEN" });
  res.json({ mapboxToken: token });
});

// =========================================================
// YOUTUBE
// =========================================================
app.get("/youtube", async (_req, res) => {
  try {
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
// S3 / R2 UPLOAD
// =========================================================
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${uuidv4()}${ext}`);
  }
});

const uploadVideo = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 },
  fileFilter: (_req, file, cb) => {
    if (!["video/mp4", "video/webm", "video/ogg"].includes(file.mimetype))
      return cb(new Error("Formato inválido"));
    cb(null, true);
  }
});

// SUBIR VIDEO (PROTEGIDO)
app.post("/upload", auth, uploadVideo.single("video"), async (req, res) => {
  const temp = req.file?.path;

  try {
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

// LISTAR VIDEOS (PROTEGIDO)
app.get("/videos", auth, async (_req, res) => {
  try {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: "videos/"
      })
    );

    const items = list.Contents || [];

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
              Key: obj.Key
            }),
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
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});