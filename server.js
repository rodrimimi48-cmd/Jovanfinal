require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

// === STREAMING APP ===
const fs = require("fs");
const os = require("os"); // 🔴 CAMBIO: usaremos temp dir del sistema
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime-types");

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
console.log("=================================");

////////////////////////////////////////////////////
// RUTA PRINCIPAL
////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

////////////////////////////////////////////////////
// CHAT IA (HUGGING FACE ROUTER FUNCIONAL + LÍMITE DINOSAURIOS)
////////////////////////////////////////////////////
app.post("/chat", async (req, res) => {
  try {
    if (!process.env.HF_API_KEY) {
      return res.status(500).json({
        error: "HF_API_KEY no configurada en el servidor"
      });
    }

    const { pregunta } = req.body;

    if (!pregunta) {
      return res.status(400).json({
        error: "La pregunta es obligatoria"
      });
    }

    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        messages: [
          { role: "system", content: "Eres un experto en dinosaurios. Responde claro y profesional." },
          { role: "user", content: `Pregunta: ${pregunta}` }
        ],
        max_tokens: 250,
        temperature: 0.7,
        stream: false
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        timeout: 60000
      }
    );

    const texto =
      response.data?.choices?.[0]?.message?.content?.trim() ||
      "Sin respuesta del modelo";

    res.json({ respuesta: texto });
  } catch (error) {
    console.error("🔥 ERROR HUGGING FACE:", error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data?.error || error.message
    });
  }
});

////////////////////////////////////////////////////
// YOUTUBE API
////////////////////////////////////////////////////
app.get("/youtube", async (req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({
        error: "YOUTUBE_API_KEY no configurada"
      });
    }

    const response = await axios.get(
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

    res.json(response.data);

  } catch (error) {
    console.error("🔥 ERROR YOUTUBE:", error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data?.error?.message || error.message
    });
  }
});

////////////////////////////////////////////////////
// FACEBOOK GRAPH API
////////////////////////////////////////////////////
app.get("/facebook", async (req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN) {
      return res.status(500).json({
        error: "Credenciales de Facebook no configuradas"
      });
    }

    // ⚠️ Si FB_PAGE_ID es de un grupo, /posts no funciona con la Graph API actual.
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.FB_PAGE_ID}/posts`,
      {
        params: {
          fields: "message,permalink_url,created_time",
          access_token: process.env.FB_ACCESS_TOKEN
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error("🔥 ERROR FACEBOOK:", error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data?.error?.message || error.message
    });
  }
});

////////////////////////////////////////////////////
// === STREAMING APP === S3 CLIENT (Cloudflare R2 o S3-compatible)
////////////////////////////////////////////////////
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || !!process.env.S3_ENDPOINT, // ✅ R2/B2 requieren path-style
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ""
  }
});

// === STREAMING APP === Multer en disco temporal + filtro MIME (evita RAM alta)
const allowedMimes = ["video/mp4", "video/webm", "video/ogg"];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()), // ✅ usa /tmp efímero
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || `.${mime.extension(file.mimetype) || "mp4"}`;
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500 MB
  fileFilter: (req, file, cb) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error("Solo se permiten videos MP4/WEBM/OGG."));
    }
    cb(null, true);
  }
});

////////////////////////////////////////////////////
// === STREAMING APP === SUBIR VIDEO (stream a R2)
////////////////////////////////////////////////////
app.post("/upload", upload.single("video"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!process.env.S3_BUCKET) {
      return res.status(500).json({ error: "S3_BUCKET no configurado" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo 'video'" });
    }

    const contentType = req.file.mimetype;
    const key = `videos/${req.file.filename}`; // ya trae UUID+ext

    // 🔴 CAMBIO: NO usar ACL con R2; acceso se maneja por token/políticas.
    const put = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fs.createReadStream(tempPath), // stream para no cargar en RAM
      ContentType: contentType
    });

    const result = await s3.send(put);

    // Limpieza del archivo temporal (no bloquear respuesta si falla)
    fs.unlink(tempPath, () => {});

    return res.status(201).json({
      ok: true,
      key,
      eTag: result.ETag || null
    });
  } catch (err) {
    // Limpieza si hubo error
    if (tempPath) fs.unlink(tempPath, () => {});
    console.error("🔥 ERROR UPLOAD:", err?.name, err?.message, err?.$metadata || "");
    return res.status(500).json({ error: err?.message || "Error subiendo el video" });
  }
});

////////////////////////////////////////////////////
// === STREAMING APP === LISTAR VIDEOS + URLs prefirmadas (GET 1h)
////////////////////////////////////////////////////
app.get("/videos", async (req, res) => {
  try {
    if (!process.env.S3_BUCKET) {
      return res.status(500).json({ error: "S3_BUCKET no configurado" });
    }

    const list = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: "videos/",
      MaxKeys: 100
    });

    const out = await s3.send(list);
    const contents = out.Contents || [];

    const results = await Promise.all(
      contents
        .filter(obj => obj.Key && !obj.Key.endsWith("/"))
        .map(async (obj) => {
          const get = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: obj.Key
          });
          const url = await getSignedUrl(s3, get, { expiresIn: 3600 }); // 1 hora
          return {
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
            url
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
// (Opcional) DEBUG R2 - Quitar en producción
////////////////////////////////////////////////////
// app.get("/debug-r2", (req, res) => {
//   res.json({
//     S3_BUCKET: process.env.S3_BUCKET,
//     S3_REGION: process.env.S3_REGION,
//     S3_ENDPOINT: process.env.S3_ENDPOINT,
//     S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
//     HAS_KEY: !!process.env.S3_ACCESS_KEY_ID,
//     HAS_SECRET: !!process.env.S3_SECRET_ACCESS_KEY
//   });
// });

////////////////////////////////////////////////////
// INICIAR SERVIDOR
////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});