require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ==================== SESIONES ====================
const sesionesActivas = new Map();

function generarToken() {
  return uuidv4();
}

function autenticar(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autorizado" });
  
  const session = sesionesActivas.get(token);
  if (!session || session.expires < Date.now()) {
    if (session) sesionesActivas.delete(token);
    return res.status(401).json({ error: "Sesión expirada" });
  }
  
  req.userEmail = session.email;
  next();
}

// ==================== 2FA ====================
const codigosVerificacion = new Map();

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
    
    console.log(`🔐 Código para ${email}: ${codigo}`);
    
    // Aquí enviarías correo con SendGrid
    // Por ahora solo mostramos en consola
    res.json({ success: true, debugCode: codigo });
  } catch (error) {
    res.status(500).json({ error: "Error al enviar el código" });
  }
});

app.post("/api/verificar-login", async (req, res) => {
  try {
    const { email, codigo } = req.body;
    const registro = codigosVerificacion.get(email);
    
    if (!registro) {
      return res.status(400).json({ error: "Código no solicitado" });
    }
    
    if (registro.expires < Date.now()) {
      codigosVerificacion.delete(email);
      return res.status(400).json({ error: "Código expirado" });
    }
    
    if (registro.codigo !== codigo) {
      return res.status(400).json({ error: "Código incorrecto" });
    }
    
    codigosVerificacion.delete(email);
    const token = generarToken();
    sesionesActivas.set(token, {
      email,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
    
    res.json({ success: true, token, email });
  } catch (error) {
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

// ==================== PDF ====================
const PDF_FOLDER = path.join(__dirname, "pdf");
if (!fs.existsSync(PDF_FOLDER)) fs.mkdirSync(PDF_FOLDER);

app.get("/api/listar-pdfs", (req, res) => {
  try {
    const files = fs.readdirSync(PDF_FOLDER);
    const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ==================== SERVIR PÁGINAS ====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor: http://localhost:${PORT}`);
  console.log(`📁 Carpeta PDF: ${PDF_FOLDER}`);
  console.log(`🔐 Login: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
});