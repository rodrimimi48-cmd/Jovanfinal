/* ============================
   script.js — Proyecto ARK
   ============================
   - SIN Three.js
   - Mapbox GL 3D
   - Google Maps 2D
   - IA / YouTube / Facebook / Streaming / Stripe / 2FA
================================ */

//////////////////////
// BASE DEL API
//////////////////////
const API_BASE = window.location.origin;

//////////////////////
// 2FA SIMPLE (CORREGIDO)
//////////////////////
async function enviarCodigo() {
  const email = prompt("Ingresa tu correo para enviarte el código:");

  if (!email) return alert("Debes ingresar un correo.");

  try {
    const r = await fetch(`${API_BASE}/enviar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await r.json();
    if (!r.ok) return alert("Error al enviar código: " + data.error);

    alert("Código enviado correctamente a tu correo.");
  } catch (err) {
    alert("Error enviando código: " + err.message);
  }
}

async function verificarCodigo() {
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");

  msg.innerText = "Verificando...";
  msg.style.color = "white";

  try {
    const r = await fetch(`${API_BASE}/verificar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo })
    });

    const data = await r.json();

    if (!r.ok) {
      msg.style.color = "red";
      msg.innerText = data.error || "Código incorrecto";
      return;
    }

    msg.style.color = "green";
    msg.innerText = "Código correcto ✔️";

  } catch (err) {
    msg.style.color = "red";
    msg.innerText = "Error verificando código";
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
    console.error(error);
  }
}
window.initMap = initMap;

//////////////////////
// IA DINOSAURIOS
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
      body: JSON.stringify({ pregunta }),
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
  const cont = document.getElementById("youtube-videos");
  const errB = document.getElementById("youtube-error");

  if (!cont || !errB) return;

  cont.innerHTML = "";
  errB.innerText = "Cargando videos...";

  try {
    const res = await fetch(`${API_BASE}/youtube`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    errB.innerText = "";

    if (!data.items || data.items.length === 0) {
      errB.innerText = "No se encontraron videos.";
      return;
    }

    data.items.forEach((item) => {
      if (item.id?.kind === "youtube#video") {
        const vid = item.id.videoId;
        const title = item.snippet?.title || "Video";

        cont.innerHTML += `
          <div class="video">
            <iframe
              width="300" height="170"
              src="https://www.youtube.com/embed/${vid}"
              title="${title}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
            <p>${title}</p>
          </div>
        `;
      }
    });

  } catch (err) {
    errB.innerText = "Error YouTube: " + err.message;
  }
}
window.cargarVideosYouTube = cargarVideosYouTube;

//////////////////////
// FACEBOOK
//////////////////////
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function cargarPostsFacebook() {
  const cont = document.getElementById("facebook-posts");
  const errB = document.getElementById("facebook-error");

  cont.innerHTML = "";
  errB.innerText = "Cargando publicaciones...";

  try {
    const res = await fetch(`${API_BASE}/facebook`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    errB.innerText = "";

    if (!data.data || data.data.length === 0) {
      errB.innerText = "No se encontraron publicaciones.";
      return;
    }

    data.data.forEach((post) => {
      const msg = post.message ? escapeHtml(post.message) : "[Sin mensaje]";
      const link = post.permalink_url || "#";

      cont.innerHTML += `
        <div class="fb-post">
          <p>${msg}</p>
          <a href="${link}" target="_blank">Ver en Facebook</a>
        </div>
      `;
    });

  } catch (err) {
    errB.innerText = "Error Facebook: " + err.message;
  }
}
window.cargarPostsFacebook = cargarPostsFacebook;

//////////////////////
// STREAMING (R2/S3)
//////////////////////
function getFileNameFromKey(key) {
  try { return (key || "").split("/").pop() || key || "archivo"; }
  catch { return key || "archivo"; }
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B","KB","MB","GB","TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function setFeatured(videoObj) {
  const v = document.getElementById("main-video");
  const fn = document.getElementById("main-filename");
  const ex = document.getElementById("main-extra");

  v.pause();
  v.src = videoObj.url;
  v.currentTime = 0;
  v.muted = true;
  v.play().catch(() => {});

  fn.textContent = getFileNameFromKey(videoObj.key);
  ex.textContent = `${formatBytes(videoObj.size)} · ${
    videoObj.lastModified ? new Date(videoObj.lastModified).toLocaleString() : ""
  }`;

  document.querySelector(".player")?.scrollIntoView({ behavior: "smooth" });
}

async function loadVideos(keepKey) {
  const grid = document.getElementById("videos-grid");
  grid.innerHTML = "Cargando...";

  try {
    const r = await fetch(`${API_BASE}/videos`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);

    grid.innerHTML = "";

    const videos = data.videos || [];

    if (!videos.length) {
      grid.innerHTML = "<em>Sin videos</em>";
      setFeatured({ url:"", key:"" });
      return;
    }

    let featured = videos[0];
    if (keepKey) {
      const found = videos.find(v => v.key === keepKey);
      if (found) featured = found;
    }

    setFeatured(featured);

    videos.forEach((v) => {
      const fn = getFileNameFromKey(v.key);

      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `
        <div class="video-wrap">
          <video class="hover-video" muted loop preload="metadata" src="${v.url}"></video>
          <div class="video-overlay"><span>${fn}</span></div>
        </div>
      `;

      const thumb = card.querySelector(".hover-video");

      if (thumb) {
        card.addEventListener("mouseenter", () => {
          thumb.currentTime = 0;
          thumb.play().catch(() => {});
        });
        card.addEventListener("mouseleave", () => {
          thumb.pause();
          thumb.currentTime = 0;
        });
      }

      card.addEventListener("click", () => setFeatured(v));
      grid.appendChild(card);
    });

  } catch (err) {
    grid.innerHTML = "Error al cargar videos";
  }
}

async function handleUpload(e) {
  e.preventDefault();

  const st = document.getElementById("upload-status");
  const inp = document.getElementById("video");
  const file = inp.files[0];

  if (!file) return;

  st.textContent = "Subiendo...";

  try {
    const fd = new FormData();
    fd.append("video", file);

    const r = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: fd
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error);

    st.textContent = "✓ Subido";
    loadVideos();

  } catch (err) {
    st.textContent = "Error: " + err.message;
  }

  setTimeout(() => st.textContent = "", 3000);
  inp.value = "";
}

//////////////////////
// PAGOS (Stripe)
//////////////////////
async function pagar() {
  try {
    const emailInput = document.getElementById("buyerEmail");
    const buyerEmail = (emailInput.value || "").trim();

    if (!buyerEmail) {
      alert("Ingresa tu correo para enviarte el ticket.");
      emailInput.focus();
      return;
    }

    const items = [{ name: "Donación ARK", qty: 1, price: 12.0 }];

    const res = await fetch(`${API_BASE}/crear-pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerEmail, items })
    });

    if (!res.ok) {
      throw new Error("Error iniciando pago");
    }

    const data = await res.json();
    window.location.href = data.url;

  } catch (e) {
    alert("Error al iniciar pago: " + e.message);
  }
}
window.pagar = pagar;

//////////////////////
// MAPBOX 3D
//////////////////////
let MAPBOX_TOKEN = "";

async function loadMapboxTokenAndInit() {
  const err = document.getElementById("map3d-error");

  try {
    const r = await fetch(`${API_BASE}/config/mapbox`, { cache:"no-store" });
    const { mapboxToken, error } = await r.json();

    if (!r.ok || !mapboxToken) throw new Error(error || "Token inválido");

    MAPBOX_TOKEN = mapboxToken;

    initMap3DWalk();

  } catch (e) {
    err.textContent = "Mapbox no inicializó: " + e.message;
  }
}

function initMap3DWalk() {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const el = document.getElementById("map3d");

  const map = new mapboxgl.Map({
    container:"map3d",
    style:"mapbox://styles/mapbox/streets-v12",
    center:[-99.1332,19.4326],
    zoom:16,
    pitch:60,
    bearing:40,
    antialias:true
  });

  map.on("style.load", () => {
    map.addSource("mapbox-dem", {
      type:"raster-dem",
      url:"mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize:512
    });

    map.setTerrain({ source:"mapbox-dem", exaggeration:1.5 });

    setupFirstPerson(map, el);
  });
}

function setupFirstPerson(map, el) {
  let pos = { lng:-99.1332, lat:19.4326, alt:20 };
  let yaw=0, pitch=0;

  const keys = new Set();

  window.addEventListener("keydown", e => keys.add(e.code));
  window.addEventListener("keyup", e => keys.delete(e.code));

  function loop() {
    const sp = 0.0001;

    if (keys.has("KeyW")) pos.lat += sp;
    if (keys.has("KeyS")) pos.lat -= sp;
    if (keys.has("KeyA")) pos.lng -= sp;
    if (keys.has("KeyD")) pos.lng += sp;

    const mc = mapboxgl.MercatorCoordinate.fromLngLat(
      [pos.lng,pos.lat],
      pos.alt
    );

    const cam = map.getFreeCameraOptions();
    cam.position = [mc.x, mc.y, mc.z];
    cam.lookAtPoint([pos.lng, pos.lat]);

    map.setFreeCameraOptions(cam);

    requestAnimationFrame(loop);
  }

  loop();
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