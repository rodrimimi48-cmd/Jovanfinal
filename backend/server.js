// ======================
// server.js — ARK Backend (JSON Database) + CORS FIX
// ======================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

// Mailer
const { sendReceiptEmail, sendVerificationCode } = require("./mailer");

// AWS S3 / R2
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
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

// App
const app = express();
app.use(express.json());

// =========================================================
// CORS CONFIG (FINAL & CORRECTO PARA GITHUB PAGES)
// =========================================================
app.use(cors({
  origin: [
    "https://rodrimimi48-cmd.github.io",
    "https://rodrimimi48-cmd.github.io/Jovanfinal",
    "https://rodrimimi48-cmd.github.io/Jovanfinal/"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.options("*", cors());

// Acrescentamos cabecera extra para Render + GitHub Pages
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// =========================================================
// ROOT — API ALIVE
// =========================================================
app.get("/", (req, res) => {
  res.json({ status: "ARK API ONLINE" });
});

// =========================================================
// REGISTER
// =========================================================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Faltan campos" });

  if (db.getUser(email))
    return res.status(400).json({ error: "El usuario ya existe" });

  const hash = await bcrypt.hash(password, 10);

  db.addUser({
    email,
    password_hash: hash,
    created_at: new Date().toISOString()
  });

  return res.json({ success: true });
});

// =========================================================
// LOGIN + 2FA
// =========================================================
const codes = new Map();

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = db.getUser(email);
  if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes.set(email, { code, expires: Date.now() + 5 * 60 * 1000 });

  sendVerificationCode(email, code).catch(() => console.log("Código 2FA:", code));

  return res.json({ step: "2FA" });
});

app.post("/verify-2fa", (req, res) => {
  const { email, code } = req.body;

  if (!codes.has(email)) return res.status(400).json({ error: "Código no solicitado" });

  const data = codes.get(email);

  if (Date.now() > data.expires) return res.status(400).json({ error: "Código expirado" });
  if (data.code !== code) return res.status(400).json({ error: "Código incorrecto" });

  codes.delete(email);

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "2h" });

  return res.json({ success: true, token });
});

// =========================================================
// JWT Middleware
// =========================================================
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token requerido" });

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =========================================================
// IA (HuggingFace)
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
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ respuesta: resp.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "IA error" });
  }
});

// =========================================================
// MAPBOX TOKEN
// =========================================================
app.get("/config/mapbox", (req, res) => {
  const token = process.env.MAPBOX_PUBLIC_TOKEN;
  if (!token) return res.status(500).json({ error: "Falta MAPBOX_PUBLIC_TOKEN" });
  res.json({ mapboxToken: token });
});

// =========================================================
// YOUTUBE
// =========================================================
app.get("/youtube", async (req, res) => {
  try {
    const r = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: "Animales prehistoricos documentales",
        type: "video",
        maxResults: 6,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    res.json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// R2 UPLOAD
// =========================================================
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

const upload = multer({ storage });

app.post("/upload", auth, upload.single("video"), async (req, res) => {
  const temp = req.file.path;

  try {
    const key = `videos/${req.file.filename}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(temp)
      })
    );

    fs.unlinkSync(temp);
    res.json({ ok: true, key });
  } catch (err) {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    res.status(500).json({ error: err.message });
  }
});

// LISTAR VIDEOS
app.get("/videos", auth, async (req, res) => {
  try {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: "videos/"
      })
    );

    const result = await Promise.all(
      (list.Contents || []).map(async obj => ({
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
app.listen(PORT, () => console.log(`🚀 API lista en puerto ${PORT}`));
