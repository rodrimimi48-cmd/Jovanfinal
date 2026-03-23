// ===========================================================
// ARK DASHBOARD – CONTROLADOR PRINCIPAL (VERSION PRO COMPLETA)
// ===========================================================

const API_BASE = "https://jovanfinal.onrender.com";

// =====================
//  PROTECCIÓN DE SESIÓN
// =====================
function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) window.location.href = "login.html";
}
checkAuth();

// =====================
//  MENÚ LATERAL
// =====================
const content = document.getElementById("content");
const menuButtons = document.querySelectorAll(".menu-btn");
const logoutBtn = document.getElementById("logout-btn");

// =====================
//  SUBMENÚ DESPLEGABLE ARK PRO
// =====================
const submenu = document.getElementById("submenu");
const submenuTitle = document.getElementById("submenu-title");
const submenuPDF = document.getElementById("submenu-pdf");
const submenuVideo = document.getElementById("submenu-video");

let submenuActive = false;

// =====================
//  RUTAS LOCALES (PDF + VIDEO)
// =====================
const info = {
    youtube: {
        title: "YouTube - Ayuda",
        pdf: "tutoriales/pdf/youtube.pdf",
        video: "tutoriales/videos/youtube.mp4"
    },
    maps: {
        title: "Google Maps - Ayuda",
        pdf: "tutoriales/pdf/maps.pdf",
        video: "tutoriales/videos/maps.mp4"
    },
    videos: {
        title: "Videos R2 - Ayuda",
        pdf: "tutoriales/pdf/videos.pdf",
        video: "tutoriales/videos/videos.mp4"
    },
    ia: {
        title: "IA Dinosaurios - Ayuda",
        pdf: "tutoriales/pdf/ia.pdf",
        video: "tutoriales/videos/ia.mp4"
    },
    map3d: {
        title: "Mapbox 3D - Ayuda",
        pdf: "tutoriales/pdf/map3d.pdf",
        video: "tutoriales/videos/map3d.mp4"
    },
    pagos: {
        title: "Donaciones Stripe - Ayuda",
        pdf: "tutoriales/pdf/pagos.pdf",
        video: "tutoriales/videos/pagos.mp4"
    }
};

// =====================
//  SUBMENÚ: MOSTRAR Y MANTENER
// =====================

// Hover en botones → abrir submenú
menuButtons.forEach(btn => {
    const section = btn.dataset.section;

    btn.addEventListener("mouseenter", () => {
        const data = info[section];
        if (!data) return;

        submenuTitle.textContent = data.title;
        submenuPDF.href = data.pdf;
        submenuVideo.href = data.video;

        submenu.classList.remove("hidden");
        submenu.classList.add("visible");

        submenuActive = true;
    });

    btn.addEventListener("click", () => loadSection(section));
});

// Hover en submenú → mantenerlo abierto
submenu.addEventListener("mouseenter", () => {
    submenuActive = true;
    submenu.classList.add("visible");
});

// Salir del área completa → cerrar submenú
function closeSubmenuIfNeeded() {
    setTimeout(() => {
        if (!submenuActive) {
            submenu.classList.remove("visible");
        }
    }, 120);
}

document.querySelector(".sidebar").addEventListener("mouseleave", () => {
    submenuActive = false;
    closeSubmenuIfNeeded();
});

submenu.addEventListener("mouseleave", () => {
    submenuActive = false;
    closeSubmenuIfNeeded();
});

// =====================
//  CARGA DE SECCIONES
// =====================
function loadSection(section) {
    switch (section) {

        // =======================
        // YOUTUBE
        // =======================
        case "youtube":
            content.innerHTML = `
                <div class="section">
                    <h2>📺 Videos de YouTube</h2>
                    <button id="yt-load" class="btn">Cargar Videos</button>
                    <div id="yt-results" class="yt-grid"></div>
                </div>`;
            document.getElementById("yt-load").addEventListener("click", loadYouTube);
            break;

        // =======================
        // GOOGLE MAPS
        // =======================
        case "maps":
            content.innerHTML = `
                <div class="section">
                    <h2>🗺️ Google Maps</h2>
                    <input type="text" id="map-search" placeholder="Buscar..." class="search-bar">
                    <button id="map-btn" class="btn">Buscar</button>
                    <div id="map" class="map-box"></div>
                </div>`;
            initMapSection();
            break;

        // =======================
        // VIDEOS R2 (PRO VISUAL)
// =======================
        case "videos":
            content.innerHTML = `
                <div class="section">
                    <h2>🎥 Videos R2</h2>

                    <form id="uploadForm">
                        <input type="file" id="video" accept="video/*">
                        <button type="submit" class="btn">Subir Video</button>
                    </form>

                    <p id="upload-status"></p>

                    <h3>📂 Biblioteca</h3>
                    <div id="videos-grid" class="videos-grid"></div>

                    <h3>🎬 Reproductor</h3>
                    <video id="main-video" controls class="main-video"></video>
                </div>`;
            initVideosSection();
            break;

        // =======================
        // IA
        // =======================
        case "ia":
            content.innerHTML = `
                <div class="section">
                    <h2>🦖 IA Dinosaurios</h2>
                    <input type="text" id="ia-question" class="search-bar" placeholder="Pregunta algo...">
                    <button id="ia-btn" class="btn">Preguntar</button>
                    <p id="ia-answer" class="ia-answer"></p>
                </div>`;
            initIA();
            break;

        // =======================
        // MAPBOX 3D
        // =======================
        case "map3d":
            content.innerHTML = `
                <div class="section">
                    <h2>🌋 Exploración 3D</h2>
                    <p>Usa W A S D, SHIFT, Q/E y el mouse.</p>
                    <div id="map3d" class="map3d-box"></div>
                </div>`;
            initMap3D();
            break;

        // =======================
        // PAGOS
        // =======================
        case "pagos":
            content.innerHTML = `
                <div class="section">
                    <h2>💳 Donaciones</h2>
                    <input id="buyerEmail" type="email" placeholder="Tu correo" class="search-bar">
                    <button id="pay-btn" class="btn">Donar $12 MXN</button>
                </div>`;
            initPayments();
            break;
    }
}

// ===================================================================
// 🎥 MÓDULO DE VIDEOS — ESTILO YOUTUBE PRO
// ===================================================================
function initVideosSection() {
    const token = localStorage.getItem("token");

    const form = document.getElementById("uploadForm");
    const grid = document.getElementById("videos-grid");
    const player = document.getElementById("main-video");
    const status = document.getElementById("upload-status");

    async function loadVideos() {
        const res = await fetch(`${API_BASE}/videos`, {
            headers: { Authorization: "Bearer " + token }
        });

        if (!res.ok) {
            grid.innerHTML = `<p>Error al cargar videos</p>`;
            return;
        }

        const data = await res.json();

        grid.innerHTML = "";

        data.videos.forEach(v => {
            const card = document.createElement("div");
            card.className = "video-card";

            card.innerHTML = `
                <div class="video-thumb-container">
                    <video class="video-thumb" src="${v.url}" muted preload="metadata"></video>
                </div>
                <p class="video-title">${v.key.split("/").pop()}</p>
            `;

            const thumb = card.querySelector(".video-thumb");

            // 🔥 HOVER: reproducir como YouTube
            card.addEventListener("mouseenter", () => {
                thumb.currentTime = 0;
                thumb.play();
            });

            // 🔥 SALIR: pausar y reiniciar
            card.addEventListener("mouseleave", () => {
                thumb.pause();
                thumb.currentTime = 0;
            });

            // 🔥 CLICK: cargar en reproductor grande
            card.addEventListener("click", () => {
                player.src = v.url;
                player.play();
            });

            grid.appendChild(card);
        });
    }

    // Upload video
    form.onsubmit = async e => {
        e.preventDefault();
        const file = document.getElementById("video").files[0];
        status.textContent = "Subiendo…";

        const fd = new FormData();
        fd.append("video", file);

        await fetch(`${API_BASE}/upload`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: fd
        });

        status.textContent = "✔ Subido";
        loadVideos();
    };

    loadVideos();
}

// ===================================================================
// YOUTUBE
// ===================================================================
async function loadYouTube() {
    const box = document.getElementById("yt-results");
    box.innerHTML = "<p>Cargando…</p>";

    try {
        const res = await fetch(`${API_BASE}/youtube`);
        const data = await res.json();

        box.innerHTML = "";

        data.items.forEach(item => {
            if (item.id?.kind !== "youtube#video") return;

            box.innerHTML += `
                <div class="yt-card">
                    https://www.youtube.com/embed/${item.id.videoId}
                    <p>${item.snippet.title}</p>
                </div>`;
        });

    } catch (err) {
        box.innerHTML = `<p>Error: ${err.message}</p>`;
    }
}

// ===================================================================
// GOOGLE MAPS
// ===================================================================
function initMapSection() {
    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 14,
        center: { lat: 19.4326, lng: -99.1332 }
    });

    const geocoder = new google.maps.Geocoder();

    document.getElementById("map-btn").addEventListener("click", () => {
        const place = document.getElementById("map-search").value;

        geocoder.geocode({ address: place }, (results, status) => {
            if (status === "OK") {
                map.setCenter(results[0].geometry.location);
                new google.maps.Marker({
                    map,
                    position: results[0].geometry.location
                });
            } else {
                alert("Lugar no encontrado.");
            }
        });
    });
}

// ===================================================================
// IA
// ===================================================================
function initIA() {
    document.getElementById("ia-btn").addEventListener("click", async () => {
        const q = document.getElementById("ia-question").value;
        const out = document.getElementById("ia-answer");

        out.textContent = "Procesando…";

        const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pregunta: q })
        });

        const data = await res.json();
        out.textContent = data.respuesta;
    });
}

// ===================================================================
// MAPBOX 3D
// ===================================================================
async function initMap3D() {
    const res = await fetch(`${API_BASE}/config/mapbox`);
    const { mapboxToken } = await res.json();

    mapboxgl.accessToken = mapboxToken;

    new mapboxgl.Map({
        container: "map3d",
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-99.1332, 19.4326],
        zoom: 16,
        pitch: 60,
        bearing: 40
    });
}

// ===================================================================
// STRIPE
// ===================================================================
function initPayments() {
    document.getElementById("pay-btn").addEventListener("click", async () => {
        const email = document.getElementById("buyerEmail").value;

        const res = await fetch(`${API_BASE}/crear-pago`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                buyerEmail: email,
                items: [
                    { name: "Donación ARK", qty: 1, price: 12 }
                ]
            })
        });

        const data = await res.json();
        window.location.href = data.url;
    });
}