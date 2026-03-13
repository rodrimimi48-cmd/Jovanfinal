"use strict";

/* =========================================================
   BASE DEL API
   ========================================================= */
const API_BASE = window.location.origin;

/* =========================================================
   2FA SIMPLE
   ========================================================= */
const codigoCorrecto = "123456";
function verificarCodigo() {
  const codigo = document.getElementById("codigo")?.value || "";
  const msg = document.getElementById("verificacion-msg");
  if (!msg) return;
  if (codigo === codigoCorrecto) {
    msg.innerText = "Verificación correcta ✅";
    msg.style.color = "green";
  } else {
    msg.innerText = "Código incorrecto ❌";
    msg.style.color = "red";
  }
}

/* =========================================================
   IA DINOSAURIOS
   ========================================================= */
async function preguntarIA() {
  const pregunta = document.getElementById("pregunta")?.value || "";
  const respuestaBox = document.getElementById("respuesta");
  if (!respuestaBox || !pregunta) return;

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

/* =========================================================
   YOUTUBE
   ========================================================= */
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
        const div = document.createElement("div");
        div.className = "video";
        div.innerHTML = `
          <iframe src="https://www.youtube.com/embed/${vid}" title="${title}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
          <p>${title}</p>
        `;
        contenedor.appendChild(div);
      }
    });
  } catch (err) {
    errorBox.innerText = "Error YouTube: " + err.message;
  }
}

/* =========================================================
   FACEBOOK
   ========================================================= */
function escapeHtml(s = "") {
  return s.replace(/[&<>\"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
  ));
}
async function cargarPostsFacebook() {
  const contenedor = document.getElementById("facebook-posts");
  const errorBox = document.getElementById("facebook-error");
  if (!contenedor || !errorBox) return;

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
      const div = document.createElement("div");
      div.className = "fb-post";
      div.innerHTML = `
        <p>${msg}</p>
        <a href="${link}" target="_blank" rel="noopener noreferrer">Ver en Facebook</a>
      `;
      contenedor.appendChild(div);
    });
  } catch (err) {
    errorBox.innerText = "Error Facebook: " + err.message;
  }
}

/* =========================================================
   STREAMING (Cloudflare R2)
   ========================================================= */
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
function setFeatured(videoObj = {}) {
  const mainVideo = document.getElementById("main-video");
  const mainFilename = document.getElementById("main-filename");
  const mainExtra = document.getElementById("main-extra");
  if (!mainVideo) return;

  try { mainVideo.pause(); } catch {}
  mainVideo.src = videoObj.url || "";
  mainVideo.currentTime = 0;
  mainVideo.muted = true;
  mainVideo.play().catch(() => {});

  const name = getFileNameFromKey(videoObj.key || "");
  const size = formatBytes(videoObj.size);
  const fecha = videoObj.lastModified ? new Date(videoObj.lastModified).toLocaleString() : "";

  if (mainFilename) mainFilename.textContent = name || "Video";
  if (mainExtra) mainExtra.textContent = `${size ? `Tamaño: ${size} · ` : ""}${fecha ? `Modificado: ${fecha}` : ""}`;

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
          thumb.pause(); thumb.currentTime = 0;
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

  if (status) status.textContent = "Subiendo...";
  try {
    const fd = new FormData();
    fd.append("video", file);
    const r = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error de subida");
    if (status) status.textContent = "✓ Subido";
    await loadVideos();
  } catch (err) {
    if (status) status.textContent = "Error: " + err.message;
  } finally {
    setTimeout(() => { if (status) status.textContent = ""; }, 3000);
    if (input) input.value = "";
  }
}

/* =========================================================
   VISOR 3D NATIVO (Three.js)
   ========================================================= */
let scene, camera, renderer, model, threeContainer, controls;
let darkBg = true;
let demoMesh = null;

function setStatus(text) {
  const s = document.getElementById("model-status");
  if (s) s.textContent = text || "";
}

function init3D() {
  threeContainer = document.getElementById("viewer3d");
  if (!threeContainer) {
    console.error("#viewer3d no existe en el DOM.");
    return;
  }
  if (!window.THREE) {
    console.error("THREE no cargó (revisa three.min.js).");
    return;
  }
  if (!THREE.OrbitControls) {
    console.error("OrbitControls no cargó (revisa la URL del CDN y el orden de scripts).");
    // seguimos, pero sin interacción
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const w = threeContainer.clientWidth;
  const h = threeContainer.clientHeight;

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.set(2, 2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  // Ajustes de salida:
  if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  if (renderer.toneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);

  // Permitir gestos/interacción
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.addEventListener("pointerdown", () => { renderer.domElement.style.cursor = "grabbing"; });
  renderer.domElement.addEventListener("pointerup",   () => { renderer.domElement.style.cursor = "grab"; });

  // Limpiar overlay y montar canvas
  threeContainer.innerHTML = "";
  threeContainer.appendChild(renderer.domElement);

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); hemi.position.set(0, 1, 0);
  const dir  = new THREE.DirectionalLight(0xffffff, 1.0);          dir.position.set(5, 10, 7); dir.castShadow = true;
  scene.add(hemi); scene.add(dir);

  // Controles (si cargaron)
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed   = 0.8;
    controls.zoomSpeed     = 1.0;
    controls.panSpeed      = 0.8;
    controls.minDistance   = 0.5;
    controls.maxDistance   = 100;
    controls.maxPolarAngle = Math.PI * 0.99;
  }

  // Modelo demo por defecto
  addDemoMesh();

  // Loop
  animate3D();

  // Eventos
  window.addEventListener("resize", onResize3D, { passive: true });
  setupDragAndDrop();
}

function addDemoMesh() {
  const geom = new THREE.TorusKnotGeometry(0.8, 0.25, 160, 32);
  const mat  = new THREE.MeshStandardMaterial({ color: 0x7a1026, metalness: 0.2, roughness: 0.5, envMapIntensity: 1.0 });
  demoMesh   = new THREE.Mesh(geom, mat);
  demoMesh.castShadow = true; demoMesh.receiveShadow = true;
  scene.add(demoMesh);
  fitModel(demoMesh);
  setStatus("Modelo de prueba cargado. Arrastra un archivo para reemplazarlo.");
}

function clearCurrentModel() {
  if (model) {
    scene.remove(model);
    model.traverse?.((c) => {
      c.geometry?.dispose?.();
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose?.());
      else c.material?.dispose?.();
    });
    model = null;
  }
  if (demoMesh) {
    scene.remove(demoMesh);
    demoMesh.geometry?.dispose?.();
    demoMesh.material?.dispose?.();
    demoMesh = null;
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
  if (demoMesh) demoMesh.rotation.y += 0.01;
  controls?.update?.();
  renderer?.render(scene, camera);
}

function fitModel(object3D) {
  const box = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);

  // Centrar al origen
  object3D.position.sub(center);

  // Alejar cámara según tamaño
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const dist = maxDim / (2 * Math.tan(fov / 2));

  camera.position.set(0, maxDim * 0.6, dist * 1.6);
  camera.lookAt(0, 0, 0);
  controls?.target?.set(0, 0, 0);
  controls?.update?.();
}

function setupDragAndDrop() {
  const zone = document.getElementById("viewer3d");
  if (!zone) return;

  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.style.outline = "3px dashed #7a1026";
      setStatus("Suelta el archivo para cargarlo…");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.style.outline = "none";
    })
  );
  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) loadModelFile(file);
  });
}

function cargarModelo3D() {
  const file = document.getElementById("modelInput")?.files?.[0];
  if (!file) {
    alert("Selecciona un modelo 3D (.glb/.gltf/.obj/.stl)");
    return;
  }
  loadModelFile(file);
}

function loadModelFile(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase(); // OJO: es .glb (NO .gbl)
  const url = URL.createObjectURL(file);

  if (!window.THREE) {
    alert("No se cargó Three.js correctamente.");
    return;
  }

  clearCurrentModel();
  setStatus(`Cargando: ${file.name}…`);

  if ((ext === "gltf" || ext === "glb") && THREE.GLTFLoader) {
    const loader = new THREE.GLTFLoader();

    // DRACO para glTF comprimidos
    if (THREE.DRACOLoader) {
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.150.1/examples/js/libs/draco/");
      loader.setDRACOLoader(draco);
    }

    loader.load(
      url,
      (gltf) => {
        model = gltf.scene || gltf.scenes?.[0];
        if (!model) throw new Error("GLTF sin escena válida.");
        scene.add(model);
        fitModel(model);
        setStatus(`Cargado: ${file.name}`);
        // liberar URL temporal
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      undefined,
      (err) => {
        console.error(err);
        setStatus("Error cargando GLTF/GLB");
        alert("Error GLTF/GLB: " + (err?.message || err));
        addDemoMesh();
      }
    );
  } else if (ext === "obj" && THREE.OBJLoader) {
    const loader = new THREE.OBJLoader();
    loader.load(
      url,
      (obj) => {
        model = obj;
        scene.add(model);
        fitModel(model);
        setStatus(`Cargado: ${file.name}`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      undefined,
      (err) => {
        console.error(err);
        setStatus("Error cargando OBJ");
        alert("Error OBJ: " + (err?.message || err));
        addDemoMesh();
      }
    );
  } else if (ext === "stl" && THREE.STLLoader) {
    const loader = new THREE.STLLoader();
    loader.load(
      url,
      (geometry) => {
        const material = new THREE.MeshStandardMaterial({
          color: 0x888888, metalness: 0.1, roughness: 0.8
        });
        model = new THREE.Mesh(geometry, material);
        model.castShadow = true; model.receiveShadow = true;
        scene.add(model);
        fitModel(model);
        setStatus(`Cargado: ${file.name}`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      undefined,
      (err) => {
        console.error(err);
        setStatus("Error cargando STL");
        alert("Error STL: " + (err?.message || err));
        addDemoMesh();
      }
    );
  } else {
    alert("Formato no compatible. Usa .glb, .gltf, .obj o .stl");
    addDemoMesh();
  }
}

function resetCamara3D() {
  if (!camera) return;
  camera.position.set(2, 2, 4);
  camera.lookAt(0, 0, 0);
  controls?.target?.set(0, 0, 0);
  controls?.update?.();
}

function toggleFondo3D() {
  darkBg = !darkBg;
  if (scene) scene.background = new THREE.Color(darkBg ? 0x111111 : 0xf0f0f0);
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // Streaming
  document.getElementById("uploadForm")?.addEventListener("submit", handleUpload);
  document.getElementById("refreshBtn")?.addEventListener("click", () => loadVideos());

  // Atajo player (barra espaciadora)
  const mainVideo = document.getElementById("main-video");
  document.addEventListener("keydown", (e) => {
    if (!mainVideo) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (mainVideo.paused) mainVideo.play().catch(() => {});
      else mainVideo.pause();
    }
  });

  // Carga inicial de videos + visor 3D
  loadVideos();
  init3D();
});

/* Exponer funciones para onclick="" en tu HTML */
window.cargarModelo3D = cargarModelo3D;
window.resetCamara3D   = resetCamara3D;
window.toggleFondo3D   = toggleFondo3D;
window.verificarCodigo = verificarCodigo;
window.preguntarIA     = preguntarIA;
window.cargarVideosYouTube = cargarVideosYouTube;
window.cargarPostsFacebook = cargarPostsFacebook;
