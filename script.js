//////////////////////
// BASE DEL API
//////////////////////
const API_BASE = window.location.origin; // mismo host/puerto del server

//////////////////////
// 2FA SIMPLE
//////////////////////
const codigoCorrecto = "123456";
function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");
  if (codigo === codigoCorrecto) {
    msg.innerText = "Verificación correcta ✅";
    msg.style.color = "green";
  } else {
    msg.innerText = "Código incorrecto ❌";
    msg.style.color = "red";
  }
}

//////////////////////
// GOOGLE MAPS
//////////////////////
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

//////////////////////
// IA DINOSAURIOS
//////////////////////
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    respuestaBox.innerText = data.respuesta;
  } catch (error) {
    respuestaBox.innerText = "Error IA: " + error.message;
  }
}

//////////////////////
// YOUTUBE
//////////////////////
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
      if (item.id.kind === "youtube#video") {
        contenedor.innerHTML += `
          <div class="video">
            <iframe width="300" height="170"
              src="https://www.youtube.com/embed/${item.id.videoId}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
            <p>${item.snippet.title}</p>
          </div>
        `;
      }
    });
  } catch (err) {
    errorBox.innerText = "Error YouTube: " + err.message;
  }
}

//////////////////////
// FACEBOOK
//////////////////////
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
      contenedor.innerHTML += `
        <div class="fb-post">
          <p>${post.message || "[Sin mensaje]"}</p>
          <a href="${post.permalink_url}" target="_blank" rel="noopener noreferrer">Ver en Facebook</a>
        </div>
      `;
    });
  } catch (err) {
    errorBox.innerText = "Error Facebook: " + err.message;
  }
}

//////////////////////
// STREAMING (Cloudflare R2) — con “player” principal
//////////////////////
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
  mainVideo.play().catch(() => {});
  const name = getFileNameFromKey(videoObj?.key || "");
  const size = formatBytes(videoObj?.size);
  const fecha = videoObj?.lastModified ? new Date(videoObj.lastModified).toLocaleString() : "";
  mainFilename.textContent = name || "Video";
  mainExtra.textContent = `${size ? `Tamaño: ${size} · ` : ""}${fecha ? `Modificado: ${fecha}` : ""}`;
  document.querySelector(".player")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function loadVideos(keepKey) {
  const grid = document.getElementById("videos-grid");
  if (!grid) return;
  grid.innerHTML = "Cargando...";
  try {
    const r = await fetch(`${API_BASE}/videos`);
    const data = await r.json();
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
          <video class="hover-video" muted playsinline preload="metadata" src="${v.url}"></video>
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
    status.textContent = "✓ Subido";
    await loadVideos();
  } catch (err) {
    status.textContent = "Error: " + err.message;
  } finally {
    setTimeout(() => (status.textContent = ""), 3000);
    if (input) input.value = "";
  }
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
      body: JSON.stringify({ buyerEmail, items }),
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
    console.error("❌ /crear-pago error:", e);
  }
}

//////////////////////
// MAPA 3D (Mapbox) — modo “caminar” (first‑person)
//////////////////////

// ⚠️ Pega tu token público de Mapbox aquí:
const MAPBOX_TOKEN = "TU_MAPBOX_ACCESS_TOKEN";

function initMap3DWalk() {
  const el = document.getElementById("map3d");
  const errBox = document.getElementById("map3d-error");
  if (!el) return;

  if (!window.mapboxgl) {
    errBox && (errBox.textContent = "No se cargó Mapbox GL JS.");
    return;
  }
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "TU_MAPBOX_ACCESS_TOKEN") {
    errBox && (errBox.textContent = "Falta MAPBOX_TOKEN en script.js");
    return;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: "map3d",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [-99.1332, 19.4326], // CDMX
    zoom: 16,
    pitch: 60,
    bearing: 40,
    antialias: true
  });

  map.addControl(new mapboxgl.NavigationControl(), "top-right");
  map.addControl(new mapboxgl.FullscreenControl());

  // Instrucciones overlay
  const hint = document.createElement("div");
  hint.style.position = "absolute";
  hint.style.right = "10px";
  hint.style.bottom = "10px";
  hint.style.background = "rgba(0,0,0,.55)";
  hint.style.color = "#fff";
  hint.style.padding = "8px 10px";
  hint.style.borderRadius = "8px";
  hint.style.fontSize = "12px";
  hint.style.pointerEvents = "none";
  hint.innerHTML = "Click para capturar mouse • W/A/S/D = mover • Ratón = mirar • Q/E = subir/bajar • Shift = sprint • Esc = liberar";
  el.appendChild(hint);

  map.on("style.load", () => {
    // Cielo/fog
    map.setFog({ range: [0.5, 10], color: "#d6e5fb", "horizon-blend": 0.02 });

    // DEM (terreno)
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14
    });
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.3 });

    // Edificios 3D
    map.addLayer({
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

    // Activar modo caminar
    setupFirstPerson(map, el);
  });
}

// Lógica de “first-person walking” con FreeCamera
function setupFirstPerson(map, containerEl) {
  let pos = { lng: map.getCenter().lng, lat: map.getCenter().lat, alt: 20 };
  let yaw = map.getBearing() * Math.PI / 180;
  let pitch = -10 * Math.PI / 180;
  let speed = 3.0;                 // m/s
  const sprint = 2.0;
  const deg = Math.PI / 180;
  const EARTH_R = 6378137;
  const keys = new Set();
  let pointerLocked = false;
  let lastTs = performance.now();

  // Pointer lock para mirar con ratón
  containerEl.addEventListener("click", () => {
    containerEl.requestPointerLock?.();
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = (document.pointerLockElement === containerEl);
  });
  document.addEventListener("mousemove", (e) => {
    if (!pointerLocked) return;
    const sens = 0.0025;
    yaw   -= e.movementX * sens;
    pitch -= e.movementY * sens;
    const maxPitch = 85 * deg;
    if (pitch >  maxPitch) pitch =  maxPitch;
    if (pitch < -maxPitch) pitch = -maxPitch;
  });

  // Teclado
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup",   (e) => keys.delete(e.code));

  function step(dt) {
    const forwardX =  Math.cos(yaw);
    const forwardY =  Math.sin(yaw);
    const rightX   = -Math.sin(yaw);
    const rightY   =  Math.cos(yaw);

    let v = speed * (keys.has("ShiftLeft") || keys.has("ShiftRight") ? sprint : 1.0);
    let dx = 0, dy = 0, dz = 0;

    if (keys.has("KeyW")) { dx += forwardX * v * dt; dy += forwardY * v * dt; }
    if (keys.has("KeyS")) { dx -= forwardX * v * dt; dy -= forwardY * v * dt; }
    if (keys.has("KeyA")) { dx -= rightX   * v * dt; dy -= rightY   * v * dt; }
    if (keys.has("KeyD")) { dx += rightX   * v * dt; dy += rightY   * v * dt; }
    if (keys.has("KeyQ")) { dz += v * dt; }
    if (keys.has("KeyE")) { dz -= v * dt; }

    const dLat = (dy / EARTH_R) * (180 / Math.PI);
    const dLng = (dx / (EARTH_R * Math.cos(pos.lat * deg))) * (180 / Math.PI);

    pos.lat = clamp(pos.lat + dLat, -85, 85);
    pos.lng = wrapLng(pos.lng + dLng);
    pos.alt = Math.max(1, pos.alt + dz);

    // Calcular punto de enfoque
    const forwardMeters = 10;
    const fx = Math.cos(pitch) * Math.cos(yaw);
    const fy = Math.cos(pitch) * Math.sin(yaw);

    const targetLat = pos.lat + (forwardMeters * fy / EARTH_R) * (180 / Math.PI);
    const targetLng = pos.lng + (forwardMeters * fx / (EARTH_R * Math.cos(pos.lat * deg))) * (180 / Math.PI);
    const target = [targetLng, targetLat];

    const cam = map.getFreeCameraOptions();
    const mc = mapboxgl.MercatorCoordinate.fromLngLat([pos.lng, pos.lat], pos.alt);
    cam.position = mc.toVector3();
    cam.lookAtPoint(target);
    map.setFreeCameraOptions(cam);
  }

  function animate(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    step(dt);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wrapLng(lng) {
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return lng;
  }
}

//////////////////////
// INIT
//////////////////////
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

  // Inicia Mapbox 3D (modo caminar)
  initMap3DWalk();
});