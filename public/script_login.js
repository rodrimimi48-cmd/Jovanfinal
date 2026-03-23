const API_BASE = "https://jovanfinal.onrender.com";

// ELEMENTOS DEL DOM
const emailInput = document.getElementById("email");
const passInput  = document.getElementById("password");
const loginBtn   = document.getElementById("login-btn");
const loginMsg   = document.getElementById("login-msg");

const codeInput  = document.getElementById("code");
const verifyBtn  = document.getElementById("verify-btn");
const codeMsg    = document.getElementById("code-msg");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");

// =====================================
//      PRIMER PASO → LOGIN
// =====================================
loginBtn.addEventListener("click", async () => {
    loginMsg.textContent = "Procesando...";

    const email = emailInput.value.trim();
    const password = passInput.value.trim();

    if (!email || !password) {
        loginMsg.textContent = "Completa todos los campos.";
        loginMsg.style.color = "salmon";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            loginMsg.textContent = data.error || "Error al iniciar sesión";
            loginMsg.style.color = "salmon";
            return;
        }

        // Mostrar el paso 2 (2FA)
        step1.style.display = "none";
        step2.style.display = "block";

        loginMsg.textContent = "";
        codeMsg.textContent = "Código enviado a tu correo";
        codeMsg.style.color = "cyan";

        // Guardamos temporalmente el email
        localStorage.setItem("tmp_email", email);

    } catch (err) {
        loginMsg.textContent = "Error: " + err.message;
        loginMsg.style.color = "salmon";
    }
});

// =====================================
//      SEGUNDO PASO → VERIFICAR 2FA
// =====================================
verifyBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    const email = localStorage.getItem("tmp_email");

    if (!code) {
        codeMsg.textContent = "Ingresa el código.";
        codeMsg.style.color = "salmon";
        return;
    }

    codeMsg.textContent = "Verificando...";

    try {
        const res = await fetch(`${API_BASE}/verify-2fa`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });

        const data = await res.json();

        if (!res.ok) {
            codeMsg.textContent = data.error || "Código inválido";
            codeMsg.style.color = "salmon";
            return;
        }

        // Guardar token
        localStorage.setItem("token", data.token);
        localStorage.removeItem("tmp_email");

        // Redirigir al dashboard
        window.location.href = "dashboard.html";

    } catch (err) {
        codeMsg.textContent = "Error: " + err.message;
        codeMsg.style.color = "salmon";
    }
});