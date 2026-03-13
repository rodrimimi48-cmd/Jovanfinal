/************* VISOR 3D NATIVO (Three.js) *************/
let scene, camera, renderer, model, threeContainer, controls;
let darkBg = true;
let demoMesh = null;

function init3D() {
  threeContainer = document.getElementById("viewer3d");
  if (!threeContainer || !window.THREE) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const w = threeContainer.clientWidth;
  const h = threeContainer.clientHeight;

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.set(2, 2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);

  // 🔑 Permitir gestos táctiles / pointer en el canvas
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.addEventListener("pointerdown", () => {
    renderer.domElement.style.cursor = "grabbing";
  });
  renderer.domElement.addEventListener("pointerup", () => {
    renderer.domElement.style.cursor = "grab";
  });

  threeContainer.innerHTML = "";
  threeContainer.appendChild(renderer.domElement);

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemi.position.set(0, 1, 0); scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5, 10, 7); dir.castShadow = true; scene.add(dir);

  // Controles de órbita
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controls.enablePan = true;
    controls.listenToKeyEvents(window); // flechas/WSAD si quieres
    // límites opcionales para evitar perder el modelo
    controls.minDistance = 0.5;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI * 0.99;
  }

  // Modelo demo por defecto (torus-knot)
  addDemoMesh();

  animate3D();

  // Resize
  window.addEventListener("resize", onResize3D, { passive: true });

  // Drag & Drop
  setupDragAndDrop();
}

function addDemoMesh() {
  const geom = new THREE.TorusKnotGeometry(0.8, 0.25, 160, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7a1026, metalness: 0.2, roughness: 0.5, envMapIntensity: 1.0,
  });
  demoMesh = new THREE.Mesh(geom, mat);
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

function setStatus(text) {
  const s = document.getElementById("model-status");
  if (s) s.textContent = text || "";
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
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);

  // Centrar al origen
  object3D.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const dist = maxDim / (2 * Math.tan(fov / 2));

  camera.position.set(0, maxDim * 0.6, dist * 1.6);
  camera.lookAt(0, 0, 0);
  controls?.target?.set(0, 0, 0);
  controls?.update?.();
}

function cargarModelo3D() {
  const fileInput = document.getElementById("modelInput");
  const file = fileInput?.files?.[0];
  if (!file) {
    alert("Selecciona un modelo 3D (.gltf, .glb, .obj, .stl)");
    return;
  }
  loadModelFile(file);
}

function setupDragAndDrop() {
  const zone = document.getElementById("viewer3d");
  if (!zone) return;

  ["dragenter", "dragover"].forEach(ev =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.style.outline = "3px dashed #7a1026";
      setStatus("Suelta el archivo para cargarlo…");
    })
  );
  ["dragleave", "drop"].forEach(ev =>
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

function loadModelFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const url = URL.createObjectURL(file);

  if (!window.THREE) {
    alert("No se cargó Three.js correctamente.");
    return;
  }

  clearCurrentModel();
  setStatus(`Cargando: ${file.name}…`);

  if ((ext === "gltf" || ext === "glb") && THREE.GLTFLoader) {
    const loader = new THREE.GLTFLoader();
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
      },
      undefined,
      (err) => {
        console.error(err);
        setStatus("Error cargando GLTF/GLB");
        alert("Error cargando GLTF/GLB: " + (err?.message || err));
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
      },
      undefined,
      (err) => {
        console.error(err);
        setStatus("Error cargando OBJ");
        alert("Error cargando OBJ: " + (err?.message || err));
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
      },
      undefined,
      (err) => {
        console.error(err);
        setStatus("Error cargando STL");
        alert("Error cargando STL: " + (err?.message || err));
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
