// ⚠️ IMPORTANTE: Reemplaza esta URL con la que obtuviste en el paso anterior
const API_URL = "https://script.google.com/macros/s/AKfycbxcYbIrbjBuK92eXOTOh4A8miWs45ehwRN0S44DkIgoZYJJU0U-baAY6irRV1NwYFjL/exec";
const API_TOKEN = "MI_TOKEN_SECRETO_123";

function login() {
  const emailInput = document.getElementById("email");
  const btn = document.getElementById("btn-login");
  const errorDiv = document.getElementById("login-error");

  if (!emailInput.value) {
    errorDiv.textContent = "Ingresá un email";
    return;
  }

  // Verificar que la URL esté configurada
  if (API_URL === "") {
    errorDiv.textContent = "ERROR: Debes actualizar la URL de la API en login.js";
    console.error("❌ URL no configurada. Lee las instrucciones en login.js");
    return;
  }

  // Feedback visual
  btn.disabled = true;
  btn.textContent = "Verificando...";
  errorDiv.textContent = "";

  console.log("Intentando login con:", emailInput.value);
  console.log("URL:", API_URL);

  fetch(`${API_URL}?action=login&token=${API_TOKEN}&email=${encodeURIComponent(emailInput.value.trim())}`)
    .then(r => {
      console.log("Response status:", r.status);
      if (!r.ok) {
        throw new Error("Error en la conexión");
      }
      return r.json();
    })
    .then(data => {
      console.log("Respuesta login:", data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Guardar datos de usuario
      localStorage.setItem("usuario", JSON.stringify({
        email: data.email,
        rol: data.rol
      }));

      // Redirigir a la aplicación
      window.location.href = "app.html";
    })
    .catch(err => {
      console.error("Error en login:", err);
      errorDiv.textContent = err.message || "Error de conexión";
      btn.disabled = false;
      btn.textContent = "Ingresar";
    });
}

// Permitir login con Enter
document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("email");
  if (emailInput) {
    emailInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        login();
      }
    });
  }
});