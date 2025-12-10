// =========================================
// AUTH.JS - Login con Google + Sesión
// =========================================

let userSession = null;

// Se ejecuta cuando Google entrega el token
function onLogin(response) {
    try {
        const data = jwt_decode(response.credential);

        userSession = {
            email: data.email,
            name: data.name,
            picture: data.picture
        };

        localStorage.setItem("userSession", JSON.stringify(userSession));

        mostrarUsuario();
        mostrarApp();
    } catch (err) {
        console.error("Error en login:", err);
    }
}

// Mostrar perfil en header
function mostrarUsuario() {
    let user = JSON.parse(localStorage.getItem("userSession"));
    if (!user) return;

    document.getElementById("user-info").innerHTML = `
        <img src="${user.picture}" style="width:35px; border-radius:50%; margin-right:10px;">
        <span>${user.name}</span>
    `;
}

// Si hay sesión guardada → entrar directo
window.onload = function() {
    let ses = localStorage.getItem("userSession");
    if (ses) {
        mostrarUsuario();
        mostrarApp();
    }
};

// Mostrar interfaz app
function mostrarApp() {
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    showSection("secClientes");
}

// Logout total
function logout() {
    google.accounts.id.disableAutoSelect();
    localStorage.removeItem("userSession");
    location.reload();
}

