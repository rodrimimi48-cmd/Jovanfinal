//////////////////////
// 2FA SIMPLE
//////////////////////
const codigoCorrecto = "123456";

function verificarCodigo(){
  const codigo = document.getElementById("codigo").value;
  const msg = document.getElementById("verificacion-msg");

  if(codigo === codigoCorrecto){
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

    new google.maps.Marker({
      position: ubicacion,
      map: map,
    });

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

  if(!pregunta) return;

  respuestaBox.innerText = "Cargando...";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Error desconocido");
    }

    respuestaBox.innerText = data.respuesta;

  } catch(error){
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

    if (!res.ok) {
      throw new Error(data.error || "Error desconocido");
    }

    errorBox.innerText = "";

    if(!data.items || data.items.length === 0){
      errorBox.innerText = "No se encontraron videos.";
      return;
    }

    data.items.forEach(item => {
      if(item.id.kind === "youtube#video"){
        contenedor.innerHTML += `
          <div class="video">
            <iframe width="300" height="170"
              src="https://www.youtube.com/embed/${item.id.videoId}"
              frameborder="0"
              allowfullscreen>
            </iframe>
            <p>${item.snippet.title}</p>
          </div>
        `;
      }
    });

  } catch(err){
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

  try{
    const res = await fetch("/facebook");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Error desconocido");
    }

    errorBox.innerText = "";

    if(!data.data || data.data.length === 0){
      errorBox.innerText = "No se encontraron publicaciones.";
      return;
    }

    data.data.forEach(post => {
      contenedor.innerHTML += `
        <div class="fb-post">
          <p>${post.message || "[Sin mensaje]"}</p>
          <a href="${post.permalink_url}" target="_blank">
            Ver en Facebook
          </a>
        </div>
      `;
    });

  } catch(err){
    errorBox.innerText = "Error Facebook: " + err.message;
  }
}