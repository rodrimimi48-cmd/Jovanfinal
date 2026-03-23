// ===========================================================
// ARK DASHBOARD – CONTROLADOR PRINCIPAL (VERSIÓN FINAL CON SUBMENÚ)
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
//  SUBMENÚ DESPLEGABLE
// =====================
const submenu = document.getElementById("submenu");
const submenuTitle = document.getElementById("submenu-title");
const submenuPDF = document.getElementById("submenu-pdf");
const submenuVideo = document.getElementById("submenu-video");

// Rutas explicativas (PDF + Video)
const info = {
    youtube: {
        title: "YouTube - Tutorial",
        pdf: "https://YOUR-PDF-LINK/youtube.pdf",
        video: "https://youtu.be/YOUR_VIDEO"
    },
    maps: {
        title: "Google Maps - Tutorial",
        pdf: "https://YOUR-PDF-LINK/maps.pdf",
        video: "https://youtu.be/YOUR_VIDEO"
    },
    videos: {
        title: "Videos R2 - Tutorial",
        pdf: "https://YOUR-PDF-LINK/videos.pdf",
        video: "https://youtu.be/YOUR_VIDEO"
    },
    ia: {
        title: "IA Dinosaurios - Tutorial",
        pdf: "https://YOUR-PDF-LINK/ia.pdf",
        video: "https://youtu.be/YOUR_VIDEO"
    },
    map3d: {
        title: "Mapbox 3D - Tutorial",
        pdf: "https://YOUR-PDF-LINK/map3d.pdf",
        video: "https://youtu.be/YOUR_VIDEO"
    },
    pagos: {
        title: "Stripe Pagos - Tutorial",
        pdf: "https://YOUR-PDF-LINK/pagos.pdf",
        video: "https://youtu.be/YOUR_VIDEO"
    }
};

// Mostrar submenú al pasar el mouse
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
    });

    // Abrir sección al hacer click
    btn.addEventListener("click", () => loadSection(section));
});

// Ocultar submenú al salir del sidebar
document.querySelector(".sidebar").addEventListener("mouseleave", () => {
    submenu.classList.remove("visible");
    submenu.classList.add("hidden");
});

// =====================
//  CARGA DE SECCIONES
// =====================
function loadSection(section) {
    switch (section) {

        // YOUTUBE
        case "youtube":
            content.innerHTML = `
                <div class="section">
                    <h2>📺 Videos de YouTube</h2>
                    <button id="yt-load" class="btn">Cargar Videos</button>
                    <div id="yt-results" class="yt-grid"></div>
                </div>`;
            document.getElementById("yt-load").addEventListener("click", loadYouTube);
            break;

        // GOOGLE MAPS
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

        // VIDEOS R2
        case "videos":
            content.innerHTML = `
                <div class="section">
                    <h2>🎥 Videos R2</h2>

                    <form id="uploadForm">
                        <input type="file" id="video" accept="video/mp4,video/webm,video/ogg">
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

        // IA
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

        // MAPBOX 3D
        case "map3d":
            content.innerHTML = `
                <div class="section">
                    <h2>🌋 Exploración 3D</h2>
                    <p>Usa W A S D, SHIFT, Q/E y el mouse.</p>
                    <div id="map3d" class="map3d-box"></div>
                </div>`;
            initMap3D();
            break;

        // PAGOS STRIPE
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
// MÓDULOS
// ===================================================================

// YOUTUBE
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
                    <iframe src="https://www.youtube.com/embed/${item.id.videoId}" allowfullscreen></iframe>
                    <p>${item.snippet.title}</p>
                </div>`;
        });

    } catch (err) {
        box.innerHTML = `<p>Error: ${err.message}</p>`;
    }
}

// GOOGLE MAPS
function initMapSection() {
    if (typeof google === "undefined") {
        alert("Falta cargar Google Maps en el HTML.");
        return;
    }

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

// IA
function initIA() {
    document.getElementById("ia-btn").addEventListener("click", async () => {
        const q = document.getElementById("ia-question").value;
        const out = document.getElementById("ia-answer");

        out.innerHTML = "Procesando…";

        const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pregunta: q })
        });

        const data = await res.json();
        out.innerHTML = data.respuesta;
    });
}

// VIDEOS R2
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
                <video src="${v.url}" muted></video>
                <p>${v.key.split("/").pop()}</p>
            `;

            card.onclick = () => {
                player.src = v.url;
                player.play();
            };

            grid.appendChild(card);
        });
    }

    form.onsubmit = async e => {
        e.preventDefault();
        const file = document.getElementById("video").files[0];
        status.innerHTML = "Subiendo…";

        const fd = new FormData();
        fd.append("video", file);

        await fetch(`${API_BASE}/upload`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: fd
        });

        status.innerHTML = "✔ Subido";
        loadVideos();
    };

    loadVideos();
}

// MAPBOX 3D
async function initMap3D() {
    const res = await fetch(`${API_BASE}/config/mapbox`);
    const { mapboxToken } = await res.json();

    if (typeof mapboxgl === "undefined") {
        alert("Falta cargar el script de Mapbox en el HTML.");
        return;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
        container: "map3d",
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-99.1332, 19.4326],
        zoom: 16,
        pitch: 60,
        bearing: 40
    });
}

// STRIPE
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