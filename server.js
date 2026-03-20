// ======================
// server.js — ARK Backend (Dashboard + Login)
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

// Stripe (opcional, lo dejamos pero no se usa en el dashboard)
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Mailer
const { sendReceiptEmail, sendVerificationCode } = require("./mailer");

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "HEAD", "OPTIONS"]
  })
);

// =========================================================
// STRIPE WEBHOOK (mantenido por si acaso)
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

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =========================================================
// SESIONES (simple en memoria)
// =========================================================
const sesionesActivas = new Map(); // token -> { email, expires }

function generarToken() {
  return uuidv4();
}

// Middleware de autenticación
function autenticar(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }
  
  const session = sesionesActivas.get(token);
  if (!session || session.expires < Date.now()) {
    if (session) sesionesActivas.delete(token);
    return res.status(401).json({ error: "Sesión expirada" });
  }
  
  req.userEmail = session.email;
  next();
}

// =========================================================
// 2FA - LOGIN CON VERIFICACIÓN
// =========================================================
const codigosVerificacion = new Map(); // email -> { codigo, expires }

app.post("/api/solicitar-codigo", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Correo inválido" });
    }
    
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    
    codigosVerificacion.set(email, {
      codigo,
      expires: Date.now() + 10 * 60 * 1000
    });
    
    try {
      await sendVerificationCode(email, codigo);
      console.log(`[2FA] Código enviado a ${email}: ${codigo}`);
      res.json({ success: true, message: "Código enviado a tu correo" });
    } catch (mailError) {
      console.error("Error enviando correo:", mailError);
      console.log(`[2FA] Código para ${email}: ${codigo}`);
      res.json({ success: true, message: "Código generado (revisa la consola del servidor)" });
    }
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error al enviar el código" });
  }
});

app.post("/api/verificar-login", async (req, res) => {
  try {
    const { email, codigo } = req.body;
    
    if (!email || !codigo) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    
    const registro = codigosVerificacion.get(email);
    
    if (!registro) {
      return res.status(400).json({ error: "Código no solicitado o expirado" });
    }
    
    if (registro.expires < Date.now()) {
      codigosVerificacion.delete(email);
      return res.status(400).json({ error: "Código expirado" });
    }
    
    if (registro.codigo !== codigo) {
      return res.status(400).json({ error: "Código incorrecto" });
    }
    
    // Código correcto, crear sesión
    codigosVerificacion.delete(email);
    const token = generarToken();
    sesionesActivas.set(token, {
      email,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días
    });
    
    res.json({ success: true, token, email });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error al verificar" });
  }
});

app.post("/api/cerrar-sesion", autenticar, async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) sesionesActivas.delete(token);
  res.json({ success: true });
});

app.get("/api/verificar-sesion", autenticar, async (req, res) => {
  res.json({ email: req.userEmail });
});

// =========================================================
// RUTAS DEL DASHBOARD (protegidas)
// =========================================================

// Ruta principal - sirve el login o dashboard según sesión
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// =========================================================
// PDF HANDLING
// =========================================================
const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const uploadPDF = multer({
  storage: pdfStorage,
  limits: { fileSize: 1024 * 1024 * 50 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Solo se permiten archivos PDF"));
    }
    cb(null, true);
  }
});

// Almacenamiento temporal de PDFs (en memoria)
const pdfsAlmacenados = new Map(); // id -> { buffer, nombre }

app.post("/api/upload-pdf", autenticar, uploadPDF.single("pdf"), async (req, res) => {
  const temp = req.file?.path;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo" });
    }
    
    const pdfBuffer = fs.readFileSync(temp);
    const pdfId = uuidv4();
    
    pdfsAlmacenados.set(pdfId, {
      buffer: pdfBuffer,
      nombre: req.file.originalname,
      email: req.userEmail,
      uploadedAt: new Date()
    });
    
    fs.unlink(temp, () => {});
    
    res.json({ success: true, pdfId, nombre: req.file.originalname });
  } catch (err) {
    if (temp) fs.unlink(temp, () => {});
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/get-pdf/:id", autenticar, async (req, res) => {
  const pdf = pdfsAlmacenados.get(req.params.id);
  
  if (!pdf) {
    return res.status(404).json({ error: "PDF no encontrado" });
  }
  
  if (pdf.email !== req.userEmail) {
    return res.status(403).json({ error: "No autorizado" });
  }
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=" + encodeURIComponent(pdf.nombre));
  res.send(pdf.buffer);
});

// =========================================================
// YOUTUBE
// =========================================================
app.get("/api/youtube", autenticar, async (_req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "Falta YOUTUBE_API_KEY" });
    }

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
app.get("/api/facebook", autenticar, async (_req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Faltan credenciales FB" });
    }

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
// S3 / R2 UPLOAD (VIDEOS)
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
    if (!allowedVideoMimes.includes(file.mimetype)) {
      return cb(new Error("Formato inválido. Solo MP4, WEBM, OGG"));
    }
    cb(null, true);
  }
});

app.post("/api/upload-video", autenticar, uploadVideo.single("video"), async (req, res) => {
  const temp = req.file?.path;

  try {
    if (!process.env.S3_BUCKET) {
      return res.status(500).json({ error: "Falta S3_BUCKET" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo" });
    }

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

app.get("/api/videos", autenticar, async (_req, res) => {
  try {
    if (!process.env.S3_BUCKET) {
      return res.status(500).json({ error: "Falta S3_BUCKET" });
    }

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
  console.log(`🚀 Servidor corriendo → http://localhost:${PORT}`);
});