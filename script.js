// =========================================================
// script.js — Dashboard ARK con Login 2FA
// =========================================================

const API_BASE = window.location.origin;
let tokenSesion = localStorage.getItem("ark_token");
let currentPdfId = null;
let pdfDoc = null;
let currentPage = 1;

// =========================================================
// FUNCIONES DE LOGIN
// =========================================================

async function solicitarCodigo() {
  const email = document.getElementById("login-email")?.value;
  const errorEl = document.getElementById("login-error");
  
  if (!email) {
    errorEl.textContent = "Ingresa un correo electrónico";
    return;
  }
  
  errorEl.textContent = "Enviando código...";
  
  try {
    const res = await fetch(`${API_BASE}/api/solicitar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error);
    }
    
    // Mostrar paso 2
    document.getElementById("login-step1").style.display = "none";
    document.getElementById("login-step2").style.display = "block";
    document.getElementById("email-display").textContent = email;
    document.getElementById("login-error").textContent = "";
    document.getElementById("verify-error").textContent = "";
    
    // Guardar email temporal
    window.tempLoginEmail = email;
    
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function verificarCodigoLogin() {
  const codigo = document.getElementById("login-codigo")?.value;
  const errorEl = document.getElementById("verify-error");
  const email = window.tempLoginEmail;
  
  if (!codigo || codigo.length !== 6) {
    errorEl.textContent = "Ingresa el código de 6 dígitos";
    return;
  }
  
  errorEl.textContent = "Verificando...";
  
  try {
    const res = await fetch(`${API_BASE}/api/verificar-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codigo })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error);
    }
    
    // Guardar token y redirigir al dashboard
    localStorage.setItem("ark_token", data.token);
    localStorage.setItem("ark_user_email", data.email);
    
    // Redirección directa
    window.location.href = "/dashboard";
    
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function volverAlLogin() {
  document.getElementById("login-step1").style.display = "block";
  document.getElementById("login-step2").style.display = "none";
  document.getElementById("login-email").value = "";
  document.getElementById("login-codigo").value = "";
  window.tempLoginEmail = null;
}

async function cerrarSesion() {
  try {
    await fetch(`${API_BASE}/api/cerrar-sesion`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("ark_token")}`
      }
    });
  } catch (err) {
    console.error("Error cerrando sesión:", err);
  }
  
  localStorage.removeItem("ark_token");
  localStorage.removeItem("ark_user_email");
  window.location.href = "/";
}

// =========================================================
// VERIFICAR SESIÓN AL CARGAR DASHBOARD
// =========================================================

async function verificarSesion() {
  const token = localStorage.getItem("ark_token");
  
  if (!token) {
    window.location.href = "/";
    return false;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/verificar-sesion`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!res.ok) {
      throw new Error("Sesión inválida");
    }
    
    const data = await res.json();
    const userEmailEl = document.getElementById("user-email");
    if (userEmailEl) userEmailEl.textContent = data.email;
    tokenSesion = token;
    return true;
    
  } catch (err) {
    localStorage.removeItem("ark_token");
    localStorage.removeItem("ark_user_email");
    window.location.href = "/";
    return false;
  }
}

// =========================================================
// NAVEGACIÓN DEL DASHBOARD (TABS)
// =========================================================

function initDashboard() {
  const navBtns = document.querySelectorAll(".nav-btn");
  const tabs = document.querySelectorAll(".tab-content");
  
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      
      navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      tabs.forEach(tab => tab.classList.remove("active"));
      const targetTab = document.getElementById(`tab-${tabId}`);
      if (targetTab) targetTab.classList.add("active");
    });
  });
  
  // Cargar videos automáticamente
  loadVideos();
}

// =========================================================
// PDF FUNCTIONS
// =========================================================

async function uploadPDF() {
  const input = document.getElementById("pdf-file");
  const file = input?.files?.[0];
  const status = document.getElementById("pdf-status");
  const viewer = document.getElementById("pdf-viewer");
  
  if (!file) {
    status.textContent = "Selecciona un archivo PDF";
    return;
  }
  
  status.textContent = "Subiendo PDF...";
  
  const formData = new FormData();
  formData.append("pdf", file);
  
  try {
    const res = await fetch(`${API_BASE}/api/upload-pdf`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tokenSesion}` },
      body: formData
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error);
    }
    
    currentPdfId = data.pdfId;
    status.textContent = `✓ PDF subido: ${data.nombre}`;
    viewer.style.display = "block";
    
    // Cargar y mostrar el PDF
    cargarPDF(currentPdfId);
    
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }
}

async function cargarPDF(pdfId) {
  const canvas = document.getElementById("pdf-canvas");
  const ctx = canvas.getContext("2d");
  
  try {
    const res = await fetch(`${API_BASE}/api/get-pdf/${pdfId}`, {
      headers: { "Authorization": `Bearer ${tokenSesion}` }
    });
    
    if (!res.ok) {
      throw new Error("Error al cargar PDF");
    }
    
    const arrayBuffer = await res.arrayBuffer();
    
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    document.getElementById("total-pages").textContent = pdfDoc.numPages;
    
    renderPage(1);
    
  } catch (err) {
    console.error("Error cargando PDF:", err);
    document.getElementById("pdf-status").textContent = "Error al cargar PDF";
  }
}

async function renderPage(pageNum) {
  if (!pdfDoc) return;
  
  const page = await pdfDoc.getPage(pageNum);
  const canvas = document.getElementById("pdf-canvas");
  const ctx = canvas.getContext("2d");
  
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };
  
  await page.render(renderContext).promise;
  document.getElementById("current-page").textContent = pageNum;
  currentPage = pageNum;
}

function prevPage() {
  if (currentPage > 1) {
    renderPage(currentPage - 1);
  }
}

function nextPage() {
  if (currentPage < pdfDoc.numPages) {
    renderPage(currentPage + 1);
  }
}

// =========================================================
// VIDEO FUNCTIONS
// =========================================================

function getFileNameFromKey(key) {
  try { 
    return (key || "").split("/").pop() || key || "archivo"; 
  } catch { 
    return key || "archivo"; 
  }
}

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 1 ? 1 : 0)} ${u[i]}`;
}

function setFeatured(videoObj) {
  const mainVideo = document.getElementById("main-video");
  const mainFilename = document.getElementById("main-filename");
  const mainExtra = document.getElementById("main-extra");
  if (!mainVideo) return;

  try { mainVideo.pause(); } catch {}
  mainVideo.src = videoObj?.url || "";
  mainVideo.currentTime = 0;

  const name = getFileNameFromKey(videoObj?.key || "");
  const size = formatBytes(videoObj?.size);
  const fecha = videoObj?.lastModified ? new Date(videoObj.lastModified).toLocaleString() : "";
  
  if (mainFilename) mainFilename.textContent = name || "Video";
  if (mainExtra) mainExtra.textContent = `${size ? `Tamaño: ${size} · ` : ""}${fecha ? `Modificado: ${fecha}` : ""}`;
}

async function loadVideos() {
  const grid = document.getElementById("videos-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Cargando videos...</div>';
  
  try {
    const r = await fetch(`${API_BASE}/api/videos`, {
      headers: { "Authorization": `Bearer ${tokenSesion}` }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

    grid.innerHTML = "";
    const videos = data.videos || [];
    
    if (!videos.length) {
      grid.innerHTML = "<em>Sin videos</em>";
      setFeatured({ url: "", key: "", size: 0, lastModified: null });
      return;
    }

    let featured = videos[0];
    setFeatured(featured);

    videos.forEach((v) => {
      const fileName = getFileNameFromKey(v.key);
      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `
        <div class="video-wrap">
          <video class="hover-video" muted loop playsinline preload="metadata" src="${v.url}"></video>
          <div class="play-badge" aria-hidden="true">
            <svg viewBox="0 0 100 100" fill="currentColor">
              <circle cx="50" cy="50" r="44" opacity=".25"></circle>
              <polygon points="40,30 75,50 40,70"></polygon>
            </svg>
          </div>
          <div class="video-overlay">
            <span class="video-filename">${fileName}</span>
          </div>
        </div>
        <div class="video-meta">
          <div><b>Tamaño:</b> ${formatBytes(v.size)}</div>
          <div><b>Modificado:</b> ${v.lastModified ? new Date(v.lastModified).toLocaleString() : ""}</div>
        </div>
      `;
      
      const thumb = card.querySelector(".hover-video");
      if (thumb) {
        card.addEventListener("mouseenter", () => {
          thumb.currentTime = 0;
          const p = thumb.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        });
        card.addEventListener("mouseleave", () => {
          thumb.pause();
          thumb.currentTime = 0;
        });
      }
      
      card.addEventListener("click", async () => {
        setFeatured(v);
        try {
          const head = await fetch(v.url, { method: "HEAD" });
          if (!head.ok) throw new Error(String(head.status));
        } catch {
          await loadVideos();
        }
      });
      
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = `<div class="error">Error al cargar videos: ${e.message}</div>`;
    console.error(e);
  }
}

async function handleUpload(e) {
  e.preventDefault();
  const status = document.getElementById("upload-status");
  const input = document.getElementById("video");
  const file = input?.files?.[0];
  
  if (!file) return;
  if (status) status.textContent = "Subiendo...";
  
  try {
    const fd = new FormData();
    fd.append("video", file);
    const r = await fetch(`${API_BASE}/api/upload-video`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tokenSesion}` },
      body: fd
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error de subida");
    if (status) status.textContent = "✓ Subido";
    await loadVideos();
  } catch (err) {
    if (status) status.textContent = "Error: " + err.message;
  } finally {
    setTimeout(() => status && (status.textContent = ""), 3000);
    if (input) input.value = "";
  }
}

// =========================================================
// SOCIAL FUNCTIONS
// =========================================================

function escapeHtml(s = "") {
  return s.replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function cargarVideosYouTube() {
  const contenedor = document.getElementById("youtube-videos");
  const errorBox = document.getElementById("youtube-error");
  if (!contenedor || !errorBox) return;
  
  contenedor.innerHTML = '<div class="loading">Cargando videos...</div>';
  errorBox.innerText = "";
  
  try {
    const res = await fetch(`${API_BASE}/api/youtube`, {
      headers: { "Authorization": `Bearer ${tokenSesion}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    
    contenedor.innerHTML = "";
    if (!data.items || data.items.length === 0) {
      errorBox.innerText = "No se encontraron videos.";
      return;
    }
    
    data.items.forEach((item) => {
      if (item.id && item.id.kind === "youtube#video") {
        const vid = item.id.videoId;
        const title = item.snippet?.title || "Video";
        contenedor.innerHTML += `
          <div class="social-card">
            <iframe
              width="100%" height="170"
              src="https://www.youtube.com/embed/${vid}"
              title="${title}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen>
            </iframe>
            <p>${escapeHtml(title)}</p>
          </div>
        `;
      }
    });
  } catch (err) {
    errorBox.innerText = "Error YouTube: " + err.message;
    contenedor.innerHTML = "";
  }
}

async function cargarPostsFacebook() {
  const contenedor = document.getElementById("facebook-posts");
  const errorBox = document.getElementById("facebook-error");
  if (!contenedor || !errorBox) return;
  
  contenedor.innerHTML = '<div class="loading">Cargando publicaciones...</div>';
  errorBox.innerText = "";
  
  try {
    const res = await fetch(`${API_BASE}/api/facebook`, {
      headers: { "Authorization": `Bearer ${tokenSesion}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    
    contenedor.innerHTML = "";
    if (!data.data || data.data.length === 0) {
      errorBox.innerText = "No se encontraron publicaciones.";
      return;
    }
    
    data.data.forEach((post) => {
      const msg = post.message ? escapeHtml(post.message.substring(0, 200)) : "[Sin mensaje]";
      const link = post.permalink_url || "#";
      contenedor.innerHTML += `
        <div class="social-card fb-post-card">
          <p>${msg}</p>
          <a href="${link}" target="_blank" rel="noopener noreferrer">Ver en Facebook →</a>
        </div>
      `;
    });
  } catch (err) {
    errorBox.innerText = "Error Facebook: " + err.message;
    contenedor.innerHTML = "";
  }
}

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Verificar si estamos en el dashboard o en login
  if (window.location.pathname === "/dashboard" || window.location.pathname.includes("dashboard")) {
    const sesionValida = await verificarSesion();
    if (sesionValida) {
      initDashboard();
      
      // Configurar upload de videos
      const uploadForm = document.getElementById("uploadForm");
      if (uploadForm) uploadForm.addEventListener("submit", handleUpload);
      
      const refreshBtn = document.getElementById("refreshBtn");
      if (refreshBtn) refreshBtn.addEventListener("click", () => loadVideos());
      
      // Control de espacio para video
      const mainVideo = document.getElementById("main-video");
      document.addEventListener("keydown", (e) => {
        if (!mainVideo) return;
        if (e.code === "Space") {
          e.preventDefault();
          if (mainVideo.paused) mainVideo.play().catch(() => {});
          else mainVideo.pause();
        }
      });
    }
  }
});

// Exponer funciones globales
window.solicitarCodigo = solicitarCodigo;
window.verificarCodigoLogin = verificarCodigoLogin;
window.volverAlLogin = volverAlLogin;
window.cerrarSesion = cerrarSesion;
window.uploadPDF = uploadPDF;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.cargarVideosYouTube = cargarVideosYouTube;
window.cargarPostsFacebook = cargarPostsFacebook;