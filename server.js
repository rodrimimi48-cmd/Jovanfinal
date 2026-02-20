require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai");
const axios = require("axios");

const app = express();

////////////////////////////////////////////////////
// MIDDLEWARES
////////////////////////////////////////////////////
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

////////////////////////////////////////////////////
// LOG DE VARIABLES (MUY IMPORTANTE EN RENDER)
////////////////////////////////////////////////////
console.log("===== VARIABLES DE ENTORNO =====");
console.log("OPENAI:", process.env.OPENAI_API_KEY ? "✅ Cargada" : "❌ No cargada");
console.log("YOUTUBE:", process.env.YOUTUBE_API_KEY ? "✅ Cargada" : "❌ No cargada");
console.log("FB_PAGE_ID:", process.env.FB_PAGE_ID ? "✅ Cargada" : "❌ No cargada");
console.log("FB_ACCESS_TOKEN:", process.env.FB_ACCESS_TOKEN ? "✅ Cargada" : "❌ No cargada");
console.log("=================================");

////////////////////////////////////////////////////
// INICIALIZAR OPENAI SOLO SI EXISTE
////////////////////////////////////////////////////
let openai = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

////////////////////////////////////////////////////
// RUTA PRINCIPAL
////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

////////////////////////////////////////////////////
// CHAT IA
////////////////////////////////////////////////////
app.post("/chat", async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no configurada en el servidor"
      });
    }

    const { pregunta } = req.body;

    if (!pregunta) {
      return res.status(400).json({
        error: "La pregunta es obligatoria"
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en dinosaurios."
        },
        { role: "user", content: pregunta }
      ],
      max_tokens: 300
    });

    res.json({
      respuesta: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("🔥 ERROR OPENAI:", error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data?.error?.message || error.message
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
          q: "dinosaurios",
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