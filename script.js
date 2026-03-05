//////////////////////
// BASE DEL API
//////////////////////
const API_BASE = window.location.origin;

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
        allowfullscreen></iframe>
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
      <a href="${post.permalink_url}" target="_blank">Ver en Facebook</a>
      </div>
      `;
    });
  } catch (err) {
    errorBox.innerText = "Error Facebook: " + err.message;
  }
}

//////////////////////
// VISOR 3D
//////////////////////

let scene;
let camera;
let renderer;
let model;
let controls;

function setModelStatus(msg) {
  const box = document.getElementById("model-status");
  if (box) box.textContent = msg;
}

function init3D() {

  const container = document.getElementById("viewer3d");

  if (!container) return;

  if (!window.THREE) {
    console.error("Three.js no cargado");
    setModelStatus("Error cargando Three.js");
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );

  camera.position.set(2, 2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );

  container.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(light);

  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  controls = new THREE.OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;

  animate3D();

  window.addEventListener("resize", () => {

    camera.aspect =
      container.clientWidth /
      container.clientHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

  });

  setModelStatus("Visor listo");

}

function animate3D() {

  requestAnimationFrame(animate3D);

  if (controls) controls.update();

  renderer.render(scene, camera);

}

function cargarModelo3D() {

  const fileInput = document.getElementById("modelInput");

  const file = fileInput.files[0];

  if (!file) {
    alert("Selecciona un modelo");
    return;
  }

  const url = URL.createObjectURL(file);

  const ext = file.name.split(".").pop().toLowerCase();

  clearModel();

  if (ext === "glb" || ext === "gltf") {

    const loader = new THREE.GLTFLoader();

    loader.load(url, (gltf) => {

      model = gltf.scene;

      scene.add(model);

      fitModel(model);

      setModelStatus("Modelo cargado");

    });

  }

  else if (ext === "obj") {

    const loader = new THREE.OBJLoader();

    loader.load(url, (obj) => {

      model = obj;

      scene.add(model);

      fitModel(model);

      setModelStatus("Modelo cargado");

    });

  }

  else if (ext === "stl") {

    const loader = new THREE.STLLoader();

    loader.load(url, (geometry) => {

      const material = new THREE.MeshStandardMaterial({
        color: 0x888888
      });

      model = new THREE.Mesh(geometry, material);

      scene.add(model);

      fitModel(model);

      setModelStatus("Modelo cargado");

    });

  }

  else {

    alert("Formato no soportado");

  }

}

function clearModel() {

  if (!model) return;

  scene.remove(model);

  model = null;

}

function fitModel(object) {

  const box = new THREE.Box3().setFromObject(object);

  const size = new THREE.Vector3();

  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);

  camera.position.set(0, maxDim, maxDim * 2);

  controls.target.set(0, 0, 0);

  controls.update();

}

function resetCamara3D() {

  if (model) fitModel(model);

}

function toggleFondo3D() {

  if (scene.background.getHex() == 0x111111) {

    scene.background = new THREE.Color(0xffffff);

  } else {

    scene.background = new THREE.Color(0x111111);

  }

}

//////////////////////
// INIT
//////////////////////

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("uploadForm")
    ?.addEventListener("submit", handleUpload);

  document.getElementById("refreshBtn")
    ?.addEventListener("click", () => loadVideos());

  loadVideos();

  if (window.THREE) {
    init3D();
  }

});