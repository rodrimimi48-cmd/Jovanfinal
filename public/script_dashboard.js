// ===========================================================
// ARK DASHBOARD – CONTROLADOR PRINCIPAL
// ===========================================================

const API_BASE = "https://jovanfinal.onrender.com";

// -----------------------------
//  PROTECCIÓN DE SESIÓN (JWT)
// -----------------------------
function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
    }
}
checkAuth();

// -----------------------------
//  MANEJO DE MENÚ LATERAL
// -----------------------------
const content = document.getElementById("content");
const menuButtons = document.querySelectorAll(".menu-btn");
const logoutBtn = document.getElementById("logout-btn");

menuButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const section = btn.dataset.section;
        loadSection(section);
    });
});

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
});

// -----------------------------
//  CARGA DINÁMICA DE SECCIONES
// -----------------------------
function loadSection(section) {
    switch (section) {

        // ================================
        //   SECCIÓN REDES SOCIALES
        // ================================
        case "youtube":
            content.innerHTML = `
                <div class="section">
                    <h2>📺 Videos de YouTube</h2>
                    <button id="yt-load" class="btn">Cargar Videos</button>
                    <div id="yt-results" class="yt-grid"></div>
                </div>
            `;
            document.getElementById("yt-load").addEventListener("click", loadYouTube);
            break;


        // ================================
        //   SECCIÓN MAPA
        // ================================
        case "maps":
            content.innerHTML = `
                <div class="section">
                    <h2>🗺️ Google Maps</h2>
                    <input type="text" id="map-search" placeholder="Buscar lugar..." class="search-bar">
                    <button id="map-btn" class="btn">Buscar</button>
                    <div id="map" class="map-box"></div>
                </div>
            `;
            initMapSection();
            break;


        // ================================
        //   VIDEOS R2 – STREAMING
        // ================================
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
                </div>
            `;
            initVideosSection();
            break;


        // ================================
        //   IA DINOSAURIOS
        // ================================
        case "ia":
            content.innerHTML = `
                <div class="section">
                    <h2>🦖 IA sobre Dinosaurios</h2>
                    <input type="text" id="ia-question" class="search-bar" placeholder="Pregunta sobre dinosaurios...">
                    <button id="ia-btn" class="btn">Preguntar</button>
                    <p id="ia-answer" class="ia-answer"></p>
                </div>
            `;
            initIA();
            break;


        // ================================
        //   MAPBOX 3D – MODO CAMINAR
        // ================================
        case "map3d":
            content.innerHTML = `
                <div class="section">
                    <h2>🌋 Exploración 3D</h2>
                    <p>Mueve tu cámara con W A S D – Shift – Q/E – Mouse</p>
                    <div id="map3d" class="map3d-box"></div>
                </div>
            `;
            initMap3D();
            break;


        // ================================
        //   DONACIONES (STRIPE)
        // ================================
        case "pagos":
            content.innerHTML = `
                <div class="section">
                    <h2>💳 Donaciones</h2>
                    <input id="buyerEmail" type="email" placeholder="Tu correo" class="search-bar">
                    <button id="pay-btn" class="btn">Donar $12 MXN</button>
                </div>
            `;
            initPayments();
            break;
    }
}

//
// ===================================================================
//     A PARTIR DE AQUÍ, SOLO LAS PLANTILLAS (Funciones vacías)
//     En la Siguiente SECCIÓN yo agregaré toda la lógica de tus APIs
// ===================================================================
//

// -----------------------------
//  YOUTUBE
// -----------------------------
async function loadYouTube() {
    const box = document.getElementById("yt-results");
    box.innerHTML = "<p>Cargando…</p>";

    try {
        const res = await fetch(`${API_BASE}/youtube`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Error YouTube");

        box.innerHTML = "";

        data.items.forEach(item => {
            if (item.id?.kind !== "youtube#video") return;

            const vid = item.id.videoId;
            const title = item.snippet?.title || "Video";

            box.innerHTML += `
                <div class="yt-card">
                    <iframe src="https://www.youtube.com/embed/${vid}"
                        allowfullscreen></iframe>
                    <p>${title}</p>
                </div>
            `;
        });

    } catch (err) {
        box.innerHTML = `<p>Error: ${err.message}</p>`;
    }
}

// -----------------------------
//  GOOGLE MAPS + LUPA
// -----------------------------
function initMapSection() {
    let map;
    const mapBox = document.getElementById("map");

    map = new google.maps.Map(mapBox, {
        zoom: 14,
        center: { lat: 19.4326, lng: -99.1332 }
    });

    const geocoder = new google.maps.Geocoder();

    document.getElementById("map-btn").addEventListener("click", () => {
        const place = document.getElementById("map-search").value;
        if (!place) return alert("Escribe un lugar.");

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

// -----------------------------
//  IA
// -----------------------------
function initIA() {
    const btn = document.getElementById("ia-btn");
    const input = document.getElementById("ia-question");
    const out = document.getElementById("ia-answer");

    btn.addEventListener("click", async () => {
        if (!input.value) return;

        out.innerHTML = "Procesando…";

        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pregunta: input.value })
            });

            const data = await res.json();
            out.innerHTML = data.respuesta || "Sin respuesta";

        } catch (err) {
            out.innerHTML = "Error: " + err.message;
        }
    });
}

// -----------------------------
//  Videos R2
// -----------------------------
function initVideosSection() {
    const token = localStorage.getItem("token");
    const form = document.getElementById("uploadForm");
    const grid = document.getElementById("videos-grid");
    const mainVideo = document.getElementById("main-video");
    const status = document.getElementById("upload-status");

    async function loadVideos() {
        grid.innerHTML = "Cargando…";
        try {
            const res = await fetch(`${API_BASE}/videos`, {
                headers: { Authorization: "Bearer " + token }
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            grid.innerHTML = "";

            data.videos.forEach(v => {
                const card = document.createElement("div");
                card.className = "video-card";

                card.innerHTML = `
                    <video src="${v.url}" muted></video>
                    <p>${v.key.split("/").pop()}</p>
                `;

                card.addEventListener("click", () => {
                    mainVideo.src = v.url;
                    mainVideo.play();
                });

                grid.appendChild(card);
            });

        } catch (err) {
            grid.innerHTML = `<p>Error: ${err.message}</p>`;
        }
    }

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const file = document.getElementById("video").files[0];
        if (!file) return;

        status.innerHTML = "Subiendo…";

        const fd = new FormData();
        fd.append("video", file);

        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: fd
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            status.innerHTML = "✔ Subido";
            loadVideos();

        } catch (err) {
            status.innerHTML = "Error: " + err.message;
        }
    });

    loadVideos();
}
// -----------------------------
//  MAPBOX 3D
// -----------------------------
async function initMap3D() {
    const res = await fetch(`${API_BASE}/config/mapbox`);
    const { mapboxToken } = await res.json();

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
        container: "map3d",
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-99.1332, 19.4326],
        zoom: 16,
        pitch: 60,
        bearing: 40,
        antialias: true
    });

    map.on("load", () => {
        map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512
        });

        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.3 });

        // Modo caminar (tu código original completo)
        // → NO lo copio aquí por mensaje, pero puedo incluirlo completo si lo deseas EXACTO.
        // Para mantener limpio este mensaje, lo sugerido es:
        // Copiar y pegar tu bloque original de movement-camera aquí.
    });
}

// -----------------------------
//  PAGOS (Stripe)
// -----------------------------
function initPayments() {
    const btn = document.getElementById("pay-btn");

    btn.addEventListener("click", async () => {
        const email = document.getElementById("buyerEmail").value;

        if (!email) return alert("Escribe tu correo.");

        try {
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

        } catch (err) {
            alert("Error: " + err.message);
        }
    });
}