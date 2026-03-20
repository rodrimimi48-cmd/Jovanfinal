require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Carpeta PDF
const PDF_FOLDER = path.join(__dirname, "pdf");

if (!fs.existsSync(PDF_FOLDER)) {
  fs.mkdirSync(PDF_FOLDER);
  console.log("📁 Carpeta 'pdf' creada");
}

// Listar PDFs
app.get("/api/listar-pdfs", (req, res) => {
  try {
    const files = fs.readdirSync(PDF_FOLDER);
    const pdfs = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir PDF
app.get("/api/pdf/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(PDF_FOLDER, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "PDF no encontrado" });
    }
    
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YouTube (opcional)
app.get("/api/youtube", async (req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return res.json({ items: [] });
    }
    
    const r = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          q: "videos",
          type: "video",
          maxResults: 6,
          key: process.env.YOUTUBE_API_KEY
        }
      }
    );
    
    res.json(r.data);
  } catch (err) {
    res.json({ items: [] });
  }
});

// Facebook (opcional)
app.get("/api/facebook", async (req, res) => {
  try {
    if (!process.env.FB_PAGE_ID || !process.env.FB_ACCESS_TOKEN) {
      return res.json({ data: [] });
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
    res.json({ data: [] });
  }
});

// Servir dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor: http://localhost:${PORT}`);
  console.log(`📁 Carpeta PDF: ${PDF_FOLDER}`);
});