"use strict";

/*************** BASE DEL API ****************/
const API_BASE = window.location.origin; // mismo host/puerto del server

/***************** 2FA SIMPLE ****************/
const codigoCorrecto = "123456";
function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");
  if (codigo === codigoCorrecto) {
    msg.innerText = "VerificaciÃ³n correcta âœ…";
    msg.style.color = "green";
  } else {
    msg.innerText = "CÃ³digo incorrecto âŒ";
    msg.style.color = "red";
  }
}

/**************** GOOGLE MAPS ****************/
function initMap() {
  try {
    const ubicacion = { lat: 19.4326, lng: -99.1332 };
    const map = new google.maps.Map(document.getElementById("map"), {
      zoom: 10,
      center: ubicacion,
    });
    new google.maps.Marker({ position: ubicacion, map });
  } catch (error) {
    document.getElementById("map-error").innerText =
      "Error cargando Google Maps: " + error.message;
  }
}
window.initMap = initMap;

/************** IA DINOSAURIOS **************/
async function preguntarIA() {
  const pregunta = document.getElementById("pregunta").value;
  const respuestaBox = document.getElementById("respuesta");
  if (!pregunta) return;
  respuestaBox.innerText = "Cargando...";
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    respuestaBox.innerText = data.respuesta || "Sin respuesta";
  } catch (error) {
    respuestaBox.innerText = "Error IA: " + error.message;
  }
}

/****************** YOUTUBE ******************/
async function cargarVideosYouTube() {
  const contenedor = document.getElementById("youtube-videos");
  const errorBox = document.getElementById("youtube-error");
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
            <iframe
              src="https://www.youtube.com/embed/${vid}"
              title="${title}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            <p>${title}</p>
          </div>
        `;
      }
    });
  } catch (err) {
    errorBox.innerText = "Error YouTube: " + err.message;
  }
}

/***************** FACEBOOK ******************/
function escapeHtml(s = "") {
  return s.replace(/[&<>\"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
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
          <a href="${link}" target="_blank" rel="noopener noreferrer">Ver en Facebook</a>
        </div>
      `;
    });
  } catch (err) {
    errorBox.innerText = "Error Facebook: " + err.message;
  }
}

/******** STREAMING (Cloudflare R2) *********/
function getFileNameFromKey(key) {
  try { return (key || "").split("/").pop() || key || "archivo"; }
  catch { return key || "archivo"; }
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
  // Autoplay cross-browser
  mainVideo.muted = true;
  mainVideo.play().catch(() => {});
  const name = getFileNameFromKey(videoObj?.key || "");
  const size = formatBytes(videoObj?.size);
  const fecha = videoObj?.lastModified ? new Date(videoObj.lastModified).toLocaleString() : "";
  mainFilename.textContent = name || "Video";
  mainExtra.textContent = `${size ? `TamaÃ±o: ${size} Â· ` : ""}${fecha ? `Modificado: ${fecha}` : ""}`;
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
      card.style.maxWidth = "360px";
      card.title = v.key;
      card.innerHTML = `
        <div class="video-wrap">
          <video class="hover-video" src="${v.url}" muted loop playsinline preload="metadata"></video>
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
          <div><b>TamaÃ±o:</b> ${formatBytes(v.size)}</div>
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
          await loadVideos(v.key);
        }
      });
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = "Error al cargar videos";
    console.error(e);
  }
}
async function handleUpload(e) {
  e.preventDefault();
  const status = document.getElementById("upload-status");
  const input = document.getElementById("video");
  const file = input?.files?.[0];
  if (!file) return;
  status.textContent = "Subiendo...";
  try {
    const fd = new FormData();
    fd.append("video", file);
    const r = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error de subida");
    status.textContent = "âœ“ Subido";
    await loadVideos();
  } catch (err) {
    status.textContent = "Error: " + err.message;
  } finally {
    setTimeout(() => (status.textContent = ""), 3000);
    if (input) input.value = "";
  }
}

/*********** PAGOS (Stripe Checkout) ***********/
async function pagar() {
  try {
    const emailInput = document.getElementById("buyerEmail");
    const buyerEmail = (emailInput?.value || "").trim();
    if (!buyerEmail) {
      alert("Ingresa tu correo para enviarte el ticket.");
      emailInput?.focus();
      return;
    }
    const items = [{ name: "DonaciÃ³n ARK", qty: 1, price: 12.0 }];
    const res = await fetch(`${window.location.origin}/crear-pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerEmail, items })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${txt}`);
    }
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert("No se pudo iniciar el pago (sin URL de Stripe)");
    }
  } catch (e) {
    alert("Error al iniciar pago: " + e.message);
    console.error("âŒ /crear-pago error:", e);
  }
}

/************* MAPA 3D (Mapbox GL JS) *************/
const MAPBOX_TOKEN = "TU_MAPBOX_ACCESS_TOKEN"; // <-- pega aquÃ­ tu token pÃºblico
function initMap3D() {
  try {
    if (!window.mapboxgl) {
      console.error("Mapbox GL JS no cargÃ³.");
      return;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Verificar soporte WebGL
    if (!mapboxgl.supported()) {
      console.warn("Mapbox GL no soportado en este navegador/dispositivo.");
      return;
    }

    // Centro en CDMX con inclinaciÃ³n y rotaciÃ³n para ver el 3D
    const map3d = new mapboxgl.Map({
      container: "map3d",
      style: "mapbox://styles/mapbox/streets-v12", // puedes probar "satellite-streets-v12"
      center: [-99.1332, 19.4326],
      zoom: 14,
      pitch: 60,
      bearing: 40,
      antialias: true
    });

    // Controles
    map3d.addControl(new mapboxgl.NavigationControl());
    map3d.addControl(new mapboxgl.FullscreenControl());
    map3d.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false
    }));

    // Terreno + edificios 3D + cielo
    map3d.on("style.load", () => {
      // Cielo/fog
      map3d.setFog({
        "range": [0.5, 10],
        "color": "#d6e5fb",
        "horizon-blend": 0.02
      });

      // Dem (terreno)
      map3d.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14
      });
      map3d.setTerrain({ source: "mapbox-dem", exaggeration: 1.3 });

      // Edificios 3D
      map3d.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#aaa",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.6
        }
      });
    });
  } catch (e) {
    console.error("Error iniciando Mapbox 3D:", e);
  }
}

/********************* INIT *********************/
document.addEventListener("DOMContentLoaded", () => {
  // Upload/lista
  document.getElementById("uploadForm")?.addEventListener("submit", handleUpload);
  document.getElementById("refreshBtn")?.addEventListener("click", () => loadVideos());

  // Atajos player: barra espaciadora play/pause
  const mainVideo = document.getElementById("main-video");
  document.addEventListener("keydown", (e) => {
    if (!mainVideo) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (mainVideo.paused) mainVideo.play().catch(() => {});
      else mainVideo.pause();
    }
  });

  // Carga inicial de videos
  loadVideos();

  // Inicia mapa 3D
  initMap3D();
});