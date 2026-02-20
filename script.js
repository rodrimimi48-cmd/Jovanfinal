//////////////////////
// 2FA SIMPLE
//////////////////////
const codigoCorrecto = "123456";

function verificarCodigo(){
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
async function preguntarIA(){
  const pregunta = document.getElementById("pregunta").value;
  const respuestaBox = document.getElementById("respuesta");

  if (!pregunta) return;
  respuestaBox.innerText = "Cargando...";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta })
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
async function cargarVideosYouTube(){
  const contenedor = document.getElementById("youtube-videos");
  const errorBox = document.getElementById("youtube-error");

  contenedor.innerHTML = "";
  errorBox.innerText = "Cargando videos...";

  try {
    const res = await fetch("/youtube");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    errorBox.innerText = "";

    if (!data.items || data.items.length === 0) {
      errorBox.innerText = "No se encontraron videos.";
      return;
    }

    data.items.forEach(item => {
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
async function cargarPostsFacebook(){
  const contenedor = document.getElementById("facebook-posts");
  const errorBox = document.getElementById("facebook-error");

  contenedor.innerHTML = "";
  errorBox.innerText = "Cargando publicaciones...";

  try {
    const res = await fetch("/facebook");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    errorBox.innerText = "";

    if (!data.data || data.data.length === 0) {
      errorBox.innerText = "No se encontraron publicaciones.";
      return;
    }

    data.data.forEach(post => {
      contenedor.innerHTML += `
        <div class="fb-post">
          <p>${post.message || "[Sin mensaje]"}</p>
          <a href="${post.permalink_url}" target="_blank" rel="noopener noreferrer">
            Ver en Facebook
          </a>
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
  try { return (key || '').split('/').pop() || key || 'archivo'; }
  catch { return key || 'archivo'; }
}
function formatBytes(bytes){
  if (bytes === undefined || bytes === null) return '';
  const u = ['B','KB','MB','GB','TB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 1 ? 1 : 0)} ${u[i]}`;
}

function setFeatured(videoObj){
  const mainVideo    = document.getElementById('main-video');
  const mainFilename = document.getElementById('main-filename');
  const mainExtra    = document.getElementById('main-extra');
  if (!mainVideo) return;

  // Pausa y asigna nueva fuente
  try { mainVideo.pause(); } catch {}
  mainVideo.src = videoObj?.url || '';
  mainVideo.currentTime = 0;

  // Reproduce automáticamente al cambiar (si el navegador lo permite)
  mainVideo.play().catch(()=>{});

  // Metadata visible
  const name  = getFileNameFromKey(videoObj?.key || '');
  const size  = formatBytes(videoObj?.size);
  const fecha = videoObj?.lastModified ? new Date(videoObj.lastModified).toLocaleString() : '';
  mainFilename.textContent = name || 'Video';
  mainExtra.textContent    = `${size ? `Tamaño: ${size} · ` : ''}${fecha ? `Modificado: ${fecha}` : ''}`;

  // Scroll suave al player (mejor UX en móvil)
  document.querySelector('.player')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Carga la lista de videos.
 * @param {string} [keepKey] - Si se indica, mantiene seleccionado ese video como "featured".
 */
async function loadVideos(keepKey) {
  const grid = document.getElementById("videos-grid");
  if (!grid) return;

  grid.innerHTML = "Cargando...";

  try {
    const r = await fetch("/videos");
    const data = await r.json();
    grid.innerHTML = "";

    const videos = data.videos || [];
    if (!videos.length) {
      grid.innerHTML = "<em>Sin videos</em>";
      setFeatured({ url: "", key: "", size: 0, lastModified: null });
      return;
    }

    // ✅ Mantener selección si llega keepKey; si no, usar el primero
    let featured = videos[0];
    if (keepKey) {
      const found = videos.find(v => v.key === keepKey);
      if (found) featured = found;
    }
    setFeatured(featured);

    videos.forEach((v) => {
      const fileName = getFileNameFromKey(v.key);

      const card = document.createElement("div");
      card.className = "video-card";
      card.style.maxWidth = "360px";
      card.title = v.key; // tooltip con la key completa

      // Miniatura con src correcto
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
          <div><b>Modificado:</b> ${v.lastModified ? new Date(v.lastModified).toLocaleString() : ''}</div>
        </div>
      `;

      // Hover preview
      const thumb = card.querySelector(".hover-video");
      if (thumb) {
        card.addEventListener("mouseenter", () => {
          thumb.currentTime = 0;
          const p = thumb.play();
          if (p && typeof p.catch === "function") p.catch(()=>{});
        });
        card.addEventListener("mouseleave", () => {
          thumb.pause();
          thumb.currentTime = 0;
        });
      }

      // Click -> ver en grande (y si expira la URL, recarga manteniendo selección)
      card.addEventListener("click", async () => {
        setFeatured(v);
        try {
          const head = await fetch(v.url, { method: 'HEAD' });
          if (!head.ok) throw new Error(String(head.status));
        } catch {
          await loadVideos(v.key); // 👈 preserva el seleccionado
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
  const input  = document.getElementById("video");
  const file   = input?.files?.[0];
  if (!file) return;

  status.textContent = "Subiendo...";

  try {
    const fd = new FormData();
    fd.append("video", file);

    const r = await fetch("/upload", { method: "POST", body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error de subida");

    status.textContent = "✓ Subido";
    await loadVideos(); // primera carga post-subida: pondrá el más reciente (tu server ordena)
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
    const res = await fetch("/crear-pago", { method: "POST" });
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert("No se pudo iniciar el pago");
    }
  } catch (e) {
    alert("Error al iniciar pago: " + e.message);
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
      if (mainVideo.paused) mainVideo.play().catch(()=>{});
      else mainVideo.pause();
    }
  });

  loadVideos(); // primera carga: destaca el primero
});