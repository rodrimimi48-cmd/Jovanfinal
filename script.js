/* ============================
   script.js — Proyecto ARK
   ============================
   - SIN Three.js
   - Mapbox GL 3D (modo caminar)
   - Google Maps 2D
   - IA / YouTube / Facebook / Streaming / Stripe / 2FA
================================ */

//////////////////////
// BASE DEL API
//////////////////////
const API_BASE = window.location.origin;

//////////////////////
// 2FA SIMPLE
//////////////////////
async function enviarCodigo() {
  const email = prompt("Ingresa tu correo para enviarte el código:");
  if (!email) return alert("Debes ingresar un correo.");

  const r = await fetch(`${API_BASE}/enviar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await r.json();
  if (!r.ok) return alert("Error: " + data.error);

  alert("Código enviado a tu correo.");
}

async function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");

  msg.innerText = "Verificando...";

  const r = await fetch(`${API_BASE}/verificar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo })
  });

  const data = await r.json();

  if (r.ok) {
    msg.style.color = "green";
    msg.innerText = "Código correcto ✔️";
  } else {
    msg.style.color = "red";
    msg.innerText = data.error;
  }
}

window.enviarCodigo = enviarCodigo;
window.verificarCodigo = verificarCodigo;

//////////////////////
// GOOGLE MAPS (2D)
//////////////////////
function initMap() {
  try {
    const ubicacion = { lat: 19.4326, lng: -99.1332 };
    const el = document.getElementById("map");
    if (!el || !window.google?.maps) return;
    const map = new google.maps.Map(el, { zoom: 10, center: ubicacion });
    new google.maps.Marker({ position: ubicacion, map });
  } catch (error) {
    const errEl = document.getElementById("map-error");
    if (errEl) errEl.innerText = "Error cargando Google Maps: " + error.message;
  }
}
window.initMap = initMap;

//////////////////////
// IA DINOSAURIOS — FIX DEFINITIVO
//////////////////////
async function preguntarIA() {
  const pregunta = document.getElementById("pregunta")?.value || "";
  const respuestaBox = document.getElementById("respuesta");
  if (!respuestaBox) return;
  if (!pregunta) return;

  respuestaBox.innerText = "Cargando...";

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error desconocido");

    respuestaBox.innerText = data.respuesta || "Sin respuesta";
  } catch (error) {
    respuestaBox.innerText = "Error IA: " + error.message;
  }
}

window.preguntarIA = preguntarIA;

//////////////////////
// YOUTUBE
//////////////////////
async function cargarVideosYouTube() {
  const contenedor = document.getElementById("youtube-videos");
  const errorBox = document.getElementById("youtube-error");
  if (!contenedor || !errorBox) return;
  contenedor.innerHTML = "";
  errorBox.innerText = "Cargando videos...";

  try {
    const res = await fetch(`${API_BASE}/youtube`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    errorBox.innerText = "";

    if (!data.items || data.items.length === 0) {
      errorBox.innerText = "No se encontraron videos.";
      return;
    }

    data.items.forEach((item) => {
      if (item.id && item.id.kind === "youtube#video") {
        const vid = item.id.videoId;
        const title = item.snippet?.title || "Video";

        contenedor.innerHTML += `
          <div class="video">
            https://www.youtube.com/embed/${vid}
            </iframe>
            <p>${title}</p>
          </div>
        `;
      }
    });

  } catch (err) {
    errorBox.innerText = "Error YouTube: " + err.message;
  }
}

window.cargarVideosYouTube = cargarVideosYouTube;

//////////////////////
// FACEBOOK
//////////////////////
function escapeHtml(s = "") {
  return s.replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

async function cargarPostsFacebook() {
  const contenedor = document.getElementById("facebook-posts");
  const errorBox = document.getElementById("facebook-error");

  contenedor.innerHTML = "";
  errorBox.innerText = "Cargando publicaciones...";

  try {
    const res = await fetch(`${API_BASE}/facebook`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    errorBox.innerText = "";

    if (!data.data || data.data.length === 0) {
      errorBox.innerText = "No se encontraron publicaciones.";
      return;
    }

    data.data.forEach((post) => {
      const msg = post.message ? escapeHtml(post.message) : "[Sin mensaje]";
      const link = post.permalink_url || "#";

      contenedor.innerHTML += `
        <div class="fb-post">
          <p>${msg}</p>
          ${link}Ver en Facebook</a>
        </div>
      `;
    });

  } catch (err) {
    errorBox.innerText = "Error Facebook: " + err.message;
  }
}

window.cargarPostsFacebook = cargarPostsFacebook;

//////////////////////
// STREAMING (R2/S3) + PLAYER
//////////////////////
function getFileNameFromKey(key) {
  try { return (key || "").split("/").pop() || key || "archivo"; }
  catch { return key || "archivo"; }
}

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = bytes;

  while (v >= 1024 && i < u.length - 1) {
    v /= 1024; i++;
  }
  return `${v.toFixed(v < 10 && i > 1 ? 1 : 0)} ${u[i]}`;
}

function setFeatured(videoObj) {
  const mainVideo = document.getElementById("main-video");
  const mainFilename = document.getElementById("main-filename");
  const mainExtra = document.getElementById("main-extra");

  try { mainVideo.pause(); } catch {}

  mainVideo.src = videoObj?.url || "";
  mainVideo.currentTime = 0;
  mainVideo.muted = true;
  mainVideo.play().catch(() => {});

  const name = getFileNameFromKey(videoObj?.key || "");
  const size = formatBytes(videoObj?.size);
  const fecha = videoObj?.lastModified ? new Date(videoObj.lastModified).toLocaleString() : "";

  if (mainFilename) mainFilename.textContent = name || "Video";
  if (mainExtra)    mainExtra.textContent    = `${size ? `Tamaño: ${size} · ` : ""}${fecha ? `Modificado: ${fecha}` : ""}`;

  document.querySelector(".player")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadVideos(keepKey) {
  const grid = document.getElementById("videos-grid");
  if (!grid) return;

  grid.innerHTML = "Cargando...";

  try {
    const r = await fetch(`${API_BASE}/videos`);
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
    if (keepKey) {
      const found = videos.find((v) => v.key === keepKey);
      if (found) featured = found;
    }

    setFeatured(featured);

    videos.forEach((v) => {
      const fileName = getFileNameFromKey(v.key);
      const card = document.createElement("div");
      card.className = "video-card";

      card.innerHTML = `
        <div class="video-wrap">
          ${v.url}</video>
          <div class="play-badge">
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
          if (p && p.catch) p.catch(() => {});
        });
        card.addEventListener("mouseleave", () => {
          thumb.pause();
          thumb.currentTime = 0;
        });
      }

      card.addEventListener("click", () => {
        setFeatured(v);
      });

      grid.appendChild(card);
    });

  } catch (e) {
    grid.innerHTML = "Error al cargar videos";
  }
}

async function handleUpload(e) {
  e.preventDefault();

  const status = document.getElementById("upload-status");
  const input  = document.getElementById("video");
  const file   = input.files[0];

  if (!file) return;

  status.textContent = "Subiendo...";

  try {
    const fd = new FormData();
    fd.append("video", file);

    const r = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: fd
    });

    const data = await r.json();

    if (!r.ok) throw new Error(data.error || "Error al subir");

    status.textContent = "✓ Subido";
    await loadVideos();

  } catch (err) {
    status.textContent = "Error: " + err.message;
  }

  setTimeout(() => {
    if (status) status.textContent = "";
  }, 3000);

  input.value = "";
}

//////////////////////
// PAGOS (Stripe Checkout)
//////////////////////
async function pagar() {
  try {
    const emailInput = document.getElementById("buyerEmail");
    const buyerEmail = (emailInput?.value || "").trim();

    if (!buyerEmail) {
      alert("Ingresa tu correo para enviarte el ticket.");
      emailInput?.focus();
      return;
    }

    const items = [{ name: "Donación ARK", qty: 1, price: 12.0 }];

    const res = await fetch(`${window.location.origin}/crear-pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerEmail, items })
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${txt}`);
    }

    const data = await res.json();

    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert("No se pudo iniciar el pago.");
    }

  } catch (e) {
    alert("Error al iniciar pago: " + e.message);
  }
}

window.pagar = pagar;

//////////////////////
// MAPBOX 3D — YA FUNCIONANDO
//////////////////////
let MAPBOX_TOKEN = "";

async function loadMapboxTokenAndInit() {
  const err = document.getElementById("map3d-error");

  try {
    const r = await fetch(`${API_BASE}/config/mapbox`, { cache: "no-store" });
    const { mapboxToken, error } = await r.json();

    if (!r.ok || !mapboxToken) throw new Error(error || "Token inválido");
    if (!window.mapboxgl) throw new Error("Mapbox no cargado");

    MAPBOX_TOKEN = mapboxToken;

    initMap3DWalk();

  } catch (e) {
    if (err) err.textContent = "Mapbox no inició: " + e.message;
  }
}

function initMap3DWalk() {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const el = document.getElementById("map3d");

  const map = new mapboxgl.Map({
    container: "map3d",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [-99.1332, 19.4326],
    zoom: 16,
    pitch: 60,
    bearing: 40,
    antialias: true
  });

  map.on("style.load", () => {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512
    });

    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

    setupFirstPerson(map);
  });
}

// Modo caminar simplificado
function setupFirstPerson(map) {
  let pos = { lng: -99.1332, lat: 19.4326, alt: 20 };
  const keys = new Set();
  let last = performance.now();

  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  function tick(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;

    const speed = 10 * dt;

    if (keys.has("KeyW")) pos.lat += speed * 0.0001;
    if (keys.has("KeyS")) pos.lat -= speed * 0.0001;
    if (keys.has("KeyA")) pos.lng -= speed * 0.0001;
    if (keys.has("KeyD")) pos.lng += speed * 0.0001;

    const mc = mapboxgl.MercatorCoordinate.fromLngLat(
      [pos.lng, pos.lat],
      pos.alt
    );

    const cam = map.getFreeCameraOptions();
    cam.position = [mc.x, mc.y, mc.z];
    cam.lookAtPoint([pos.lng, pos.lat]);
    map.setFreeCameraOptions(cam);

    requestAnimationFrame(tick);
  }

  tick(last);
}

//////////////////////
// INIT
//////////////////////
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("uploadForm")?.addEventListener("submit", handleUpload);
  document.getElementById("refreshBtn")?.addEventListener("click", () => loadVideos());
  loadVideos();
  loadMapboxTokenAndInit();
});