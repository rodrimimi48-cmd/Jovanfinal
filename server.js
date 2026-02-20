require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

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
console.log("=================================");

////////////////////////////////////////////////////
// RUTA PRINCIPAL
////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

////////////////////////////////////////////////////
// CHAT IA (HUGGING FACE ROUTER FUNCIONAL)
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
      "https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        inputs: `<s>[INST] Eres un experto en dinosaurios. Responde claro y profesional. 
Pregunta: ${pregunta} [/INST]`,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          return_full_text: false
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    const texto =
      response.data?.[0]?.generated_text ||
      response.data?.generated_text ||
      "Sin respuesta del modelo";

    res.json({
      respuesta: texto.trim()
    });

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

    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.FB_PAGE_ID}/posts`,
      {
        params: {
          fields: "message,permalink_url",
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
// INICIAR SERVIDOR
////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});