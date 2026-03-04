//////////////////////
// BASE DEL API
//////////////////////
const API_BASE = window.location.origin; // mismo host/puerto del server

// === OPCIONAL: si quieres forzar un modelo público de R2, pégalo aquí ===
// Ejemplo: "https://pub-xxxxxxxxxxxx.r2.dev/models/giganoto.glb"
const R2_PUBLIC_MODEL_URL = "";

/* Utilidad: extraer extensión de una URL (ignora querystring) */
function getExtFromUrl(url = "") {
  try {
    const clean = url.split("?")[0];
    const ext = clean.split(".").pop();
    return (ext || "").toLowerCase();
  } catch {
    return "";
  }
}

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
// VISOR 3D (Three.js)
//////////////////////
let scene, camera, renderer, model, threeContainer, controls;
let lastBgDark = true;

/** Overlay de estado en el visor */
function setModelStatus(msg) {
  const container = document.getElementById("viewer3d");
  if (!container) return;
  let box = document.getElementById("model-status");
  if (!box) {
    box = document.createElement("div");
    box.id = "model-status";
    box.style.position = "absolute";
    box.style.left = "12px";
    box.style.bottom = "12px";
    box.style.background = "rgba(0,0,0,.6)";
    box.style.color = "#fff";
    box.style.padding = "6px 10px";
    box.style.borderRadius = "8px";
    box.style.fontSize = "12px";
    container.style.position = "relative";
    container.appendChild(box);
  }
  box.textContent = msg || "";
}

function init3D() {
  threeContainer = document.getElementById("viewer3d");
  if (!threeContainer || !window.THREE) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(
    60,
    threeContainer.clientWidth / threeContainer.clientHeight,
    0.1,
    2000
  );
  camera.position.set(2, 2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  threeContainer.innerHTML = ""; // limpia si había algo
  threeContainer.appendChild(renderer.domElement);

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Controles de órbita (si está cargado el script)
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
  }

  // Drag & Drop
  threeContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    setModelStatus("Suelta el archivo para cargar…");
  });
  threeContainer.addEventListener("dragleave", () => {
    setModelStatus("Arrastra aquí un .glb/.gltf o usa el botón.");
  });
  threeContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!e.dataTransfer.files?.length) return;
    const file = e.dataTransfer.files[0];
    cargarArchivo3D(file);
  });

  animate3D();

  // Resize
  window.addEventListener("resize", onResize3D);

  // Mensaje inicial
  setModelStatus("Arrastra aquí un .glb/.gltf o usa “Cargar modelo 3D”.");

  // --- Auto-carga ---
  // 1) Si definiste una URL pública de R2, úsala:
  if (R2_PUBLIC_MODEL_URL) {
    const ext = getExtFromUrl(R2_PUBLIC_MODEL_URL);
    cargarUrl3D(R2_PUBLIC_MODEL_URL, ext);
  } else {
    // 2) Si no, intenta cargar el más reciente desde tu API (/models):
    loadLatestModelFromAPI();
  }
}

async function loadLatestModelFromAPI() {
  try {
    setModelStatus("Buscando modelo más reciente…");
    const r = await fetch(`${API_BASE}/models`);
    const data = await r.json();
    const models = data.models || [];
    if (!models.length) {
      setModelStatus("Sin modelos en la nube. Sube uno o arrastra un archivo.");
      return;
    }
    const m = models[0]; // ya vienen ordenados por server (más reciente primero)
    const ext = getExtFromUrl(m.url) || getExtFromUrl(m.key);
    cargarUrl3D(m.url, ext);
  } catch (e) {
    console.error("No se pudo cargar /models:", e);
    setModelStatus("No se pudo listar modelos. Revisa el servidor o CORS.");
  }
}

function onResize3D() {
  if (!renderer || !camera || !threeContainer) return;
  const w = threeContainer.clientWidth;
  const h = threeContainer.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function clearModel3D() {
  if (!model) return;
  scene.remove(model);
  model.traverse?.((c) => {
    if (c.geometry) c.geometry.dispose?.();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose?.());
      else c.material.dispose?.();
    }
    if (c.texture) c.texture.dispose?.();
  });
  model = null;
}

function fitModel(object3D) {
  // centra y escala el modelo para que quepa en cámara
  const box = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Re-centra el modelo al origen
  object3D.position.x += (object3D.position.x - center.x);
  object3D.position.y += (object3D.position.y - center.y);
  object3D.position.z += (object3D.position.z - center.z);

  // Calcula distancia para encuadre
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = camera.fov * (Math.PI / 180);
  const dist = maxDim / (2 * Math.tan(fov / 2));
  camera.position.set(0, maxDim * 0.5, dist * 1.4);
  camera.near = Math.max(0.1, dist / 1000);
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  } else {
    camera.lookAt(0, 0, 0);
  }
}

function cargarModelo3D() {
  const fileInput = document.getElementById("modelInput");
  const file = fileInput?.files?.[0];
  if (!file) {
    alert("Selecciona un modelo 3D (.gltf, .glb). Para OBJ/STL debes incluir sus loaders.");
    return;
  }
  cargarArchivo3D(file);
}

function cargarArchivo3D(file) {
  const url = URL.createObjectURL(file);
  const ext = (file.name || "").split(".").pop().toLowerCase();
  cargarUrl3D(url, ext, () => URL.revokeObjectURL(url));
}

function cargarUrl3D(url, ext, done) {
  try {
    setModelStatus("Cargando… 0%");
    // Limpia modelo anterior
    clearModel3D();

    const onProgress = (xhr) => {
      if (!xhr?.lengthComputable) return;
      const p = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
      setModelStatus(`Cargando… ${p}%`);
    };
    const onError = (err) => {
      console.error("❌ Error cargando modelo:", err);
      setModelStatus("Error cargando modelo. Revisa CORS/MIME/URL.");
      done?.();
    };

    // GLTF/GLB
    if ((ext === "gltf" || ext === "glb") && THREE.GLTFLoader) {
      const loader = new THREE.GLTFLoader();

      // Si está DRACO disponible (solo si agregaste el script en el HTML)
      if (THREE.DRACOLoader) {
        const draco = new THREE.DRACOLoader();
        // Ajusta si subes los decoders a tu CDN/Bucket
        draco.setDecoderPath("https://unpkg.com/three@0.160.0/examples/js/libs/draco/");
        loader.setDRACOLoader(draco);
      }

      loader.load(
        url,
        (gltf) => {
          model = gltf.scene || gltf.scenes?.[0];
          scene.add(model);
          fitModel(model);
          setModelStatus("Listo ✔");
          done?.();
        },
        onProgress,
        onError
      );
    }
    // OBJ
    else if (ext === "obj" && THREE.OBJLoader) {
      const loader = new THREE.OBJLoader();
      loader.load(
        url,
        (obj) => {
          model = obj;
          scene.add(model);
          fitModel(model);
          setModelStatus("Listo ✔");
          done?.();
        },
        onProgress,
        onError
      );
    }
    // STL
    else if (ext === "stl" && THREE.STLLoader) {
      const loader = new THREE.STLLoader();
      loader.load(
        url,
        (geometry) => {
          const material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.1,
            roughness: 0.8,
          });
          model = new THREE.Mesh(geometry, material);
          scene.add(model);
          fitModel(model);
          setModelStatus("Listo ✔");
          done?.();
        },
        onProgress,
        onError
      );
    } else {
      alert("Formato no compatible o loader no disponible. Usa .glb/.gltf o agrega los loaders de OBJ/STL en el HTML.");
      setModelStatus("Formato no soportado.");
      done?.();
    }
  } catch (e) {
    console.error(e);
    setModelStatus("Error inesperado cargando modelo.");
    done?.();
  }
}

function resetCamara3D() {
  if (!model) return;
  fitModel(model);
}

function toggleFondo3D() {
  lastBgDark = !lastBgDark;
  scene.background = new THREE.Color(lastBgDark ? 0x111111 : 0xf3f3f3);
}

// Exponer funciones para los botones del HTML (por si acaso)
window.cargarModelo3D = cargarModelo3D;
window.resetCamara3D = resetCamara3D;
window.toggleFondo3D = toggleFondo3D;

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

  // Inicia visor 3D
  init3D();
});