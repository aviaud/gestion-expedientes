console.log("APP.JS CARGADO - VERSION FINAL INTEGRADA");

// ⚠️ IMPORTANTE: PEGA AQUÍ LA URL DE TU NUEVA IMPLEMENTACIÓN
const API_URL = "https://script.google.com/macros/s/AKfycbxcYbIrbjBuK92eXOTOh4A8miWs45ehwRN0S44DkIgoZYJJU0U-baAY6irRV1NwYFjL/exec"; 
const API_TOKEN = "MI_TOKEN_SECRETO_123";

let USUARIO = null;
let ROL = null;
let EXPEDIENTE_ID = null;
let EXPEDIENTES_CACHE = [];
let AUDIENCIAS_CACHE = [];
let FILTRO_AUDIENCIAS = 'todas';

/************ INIT ************/
document.addEventListener("DOMContentLoaded", () => {
  // Verificar sesión
  const data = localStorage.getItem("usuario");
  if (!data) {
    window.location.href = "index.html"; 
    return;
  }

  // Cargar usuario
  try {
    const u = JSON.parse(data);
    USUARIO = u.email;
    ROL = u.rol;
  } catch (e) {
    logout();
    return;
  }

  // Mostrar info usuario
  const userInfo = document.getElementById("usuario-info");
  if(userInfo) userInfo.innerText = `${USUARIO} (${ROL})`;

  // Ocultar controles de admin si no es admin
  if (ROL !== "admin") {
    document.querySelectorAll(".admin-only").forEach(e => e.style.display = "none");
  }

  console.log("✓ Usuario:", USUARIO, "| Rol:", ROL);

  // Iniciar carga de datos
  cargarExpedientes();
  verificarRecordatorios();
  
  // Polling para recordatorios (cada 5 min)
  setInterval(verificarRecordatorios, 5 * 60 * 1000);
});

/************ UTILIDADES ************/
function mostrarToast(mensaje, tipo = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensaje;
  
  container.appendChild(toast);
  
  // Animación entrada
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Animación salida y eliminación
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

/************ EXPEDIENTES ************/
function cargarExpedientes() {
  const lista = document.getElementById("lista-expedientes");
  if(!lista) return;
  
  lista.innerHTML = "<li>Cargando expedientes...</li>";

  fetch(`${API_URL}?action=listarExpedientes&token=${API_TOKEN}`)
    .then(r => r.json())
    .then(data => {
      console.log("Expedientes cargados:", data);
      
      if (data.error) throw new Error(data.error);
      
      EXPEDIENTES_CACHE = data;
      renderExpedientes(data);
    })
    .catch(err => {
      console.error("Error cargando expedientes:", err);
      lista.innerHTML = "<li class='error'>Error de conexión. Intenta recargar.</li>";
      mostrarToast("Error al cargar expedientes", "error");
    });
}

function renderExpedientes(data) {
  const ul = document.getElementById("lista-expedientes");
  ul.innerHTML = "";

  if(!data || data.length === 0) {
    ul.innerHTML = "<li class='empty'>No hay expedientes registrados.</li>";
    return;
  }

  data.forEach(e => {
    // e[0]=ID, e[1]=Numero, e[2]=Caratula, e[3]=Fecha, e[4]=FolderID
    const li = document.createElement("li");
    const folderId = e[4]; // ID de la carpeta en Drive

    // HTML del item
    let htmlContent = `<strong>${e[1]}</strong> - ${e[2]}`;
    
    // Si tiene carpeta, agregamos icono
    if (folderId) {
      htmlContent += ` <a href="https://drive.google.com/drive/folders/${folderId}" target="_blank" title="Abrir carpeta en Drive" onclick="event.stopPropagation()" style="text-decoration:none;">📂</a>`;
    }

    li.innerHTML = htmlContent;
    
    // Al hacer click, seleccionamos el expediente
    li.onclick = () => seleccionarExpediente(e, li);
    
    ul.appendChild(li);
  });
}

function seleccionarExpediente(exp, li) {
  EXPEDIENTE_ID = exp[0];
  console.log("Seleccionado:", EXPEDIENTE_ID);

  // Estilos de selección
  document.querySelectorAll("#lista-expedientes li").forEach(l => l.classList.remove("seleccionado"));
  li.classList.add("seleccionado");

  // Actualizar textos de cabecera
  const infoTexto = `Expediente: ${exp[1]} - ${exp[2]}`;
  const labelDocs = document.getElementById("expediente-actual");
  const labelAuds = document.getElementById("expediente-audiencias");
  
  if(labelDocs) labelDocs.innerText = infoTexto;
  if(labelAuds) labelAuds.innerText = infoTexto;
  
  // Limpiar listas secundarias
  document.getElementById("lista-documentos").innerHTML = "<li>Cargando...</li>";
  document.getElementById("lista-audiencias").innerHTML = "<li>Cargando...</li>";

  // Cargar datos relacionados
  cargarDocumentos();
  cargarAudiencias();
  cargarAuditoriaExpediente();
}

function crearExpediente() {
  if (ROL !== "admin") return;

  const numero = document.getElementById("numero").value;
  const caratula = document.getElementById("caratula").value;
  const btn = event.target; // El botón que fue clickeado

  if(!numero || !caratula) {
    mostrarToast("Completa número y carátula", "warning");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Creando...";

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      token: API_TOKEN,
      action: "crearExpediente",
      numero,
      caratula,
      email: USUARIO
    })
  })
    .then(r => r.json())
    .then(resp => {
      if (resp.error) throw new Error(resp.error);
      
      document.getElementById("numero").value = "";
      document.getElementById("caratula").value = "";
      mostrarToast("Expediente y carpeta creados", "success");
      cargarExpedientes(); // Recargar la lista
    })
    .catch(err => {
      console.error(err);
      mostrarToast("Error: " + err.message, "error");
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerText = "Crear";
    });
}

function buscarExpedientes() {
  const input = document.getElementById("buscador");
  if(!input) return;
  
  const q = input.value.toLowerCase();
  
  if(!EXPEDIENTES_CACHE) return;

  const filtrados = EXPEDIENTES_CACHE.filter(e =>
    String(e[1]).toLowerCase().includes(q) ||
    String(e[2]).toLowerCase().includes(q)
  );

  renderExpedientes(filtrados);
}

/************ DOCUMENTOS ************/
function cargarDocumentos() {
  if (!EXPEDIENTE_ID) return;

  fetch(`${API_URL}?action=listarDocumentos&token=${API_TOKEN}&expediente_id=${EXPEDIENTE_ID}`)
    .then(r => r.json())
    .then(data => {
      const ul = document.getElementById("lista-documentos");
      ul.innerHTML = "";
      
      if(data.error) throw new Error(data.error);
      
      if(data.length === 0) {
        ul.innerHTML = "<li class='empty'>No hay documentos.</li>";
        return;
      }

      data.forEach(d => {
        const li = document.createElement("li");
        // d[2]=Nombre, d[3]=Tipo, d[4]=FileID
        li.innerHTML = `
          <span>
            <strong>${d[2]}</strong> <small class="muted">(${d[3]})</small>
          </span>
          <div>
            <button onclick="descargarDocumento('${d[4]}')" title="Ver/Descargar">⬇</button>
            ${ROL === "admin" ? `<button class="btn-danger" onclick="eliminarDocumento('${d[0]}')" title="Eliminar">🗑</button>` : ""}
          </div>
        `;
        ul.appendChild(li);
      });
    })
    .catch(err => mostrarToast("Error docs: " + err.message, "error"));
}

function subirDocumento() {
  if (!EXPEDIENTE_ID) {
    mostrarToast("Seleccioná un expediente primero", "warning");
    return;
  }

  const fileInput = document.getElementById("archivo");
  const file = fileInput.files[0];
  if (!file) {
    mostrarToast("Seleccioná un archivo PDF", "warning");
    return;
  }
  
  // Limite 5MB para evitar timeouts en Apps Script gratis
  if (file.size > 5 * 1024 * 1024) {
    mostrarToast("El archivo es muy pesado (Max 5MB)", "warning");
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.innerText = "Subiendo...";

  const reader = new FileReader();
  reader.onload = () => {
    // Extraer base64 puro (sin el encabezado data:application/pdf...)
    const base64Data = reader.result.split(",")[1];

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        token: API_TOKEN,
        action: "subirDocumento",
        expediente_id: EXPEDIENTE_ID,
        nombre: file.name,
        tipo: document.getElementById("tipo").value,
        base64: base64Data,
        email: USUARIO
      })
    })
    .then(r => r.json())
    .then(resp => {
        if(resp.error) throw new Error(resp.error);
        fileInput.value = ""; // Limpiar input
        mostrarToast("Documento guardado en Drive", "success");
        cargarDocumentos();
    })
    .catch(e => mostrarToast("Error al subir: " + e.message, "error"))
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Subir";
    });
  };
  reader.readAsDataURL(file);
}

function eliminarDocumento(id) {
  if (ROL !== "admin") return;
  if(!confirm("¿Estás seguro de eliminar este documento de Drive?")) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      token: API_TOKEN,
      action: "eliminarDocumento",
      documento_id: id,
      email: USUARIO
    })
  })
  .then(r => r.json())
  .then(data => {
    if(data.error) throw new Error(data.error);
    mostrarToast("Documento eliminado", "success");
    cargarDocumentos();
  })
  .catch(err => mostrarToast("Error: " + err.message, "error"));
}

function descargarDocumento(fileId) {
  // Abre el visor de Drive
  window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
}

/************ AUDIENCIAS ************/
function cargarAudiencias() {
  if (!EXPEDIENTE_ID) return;
  
  const ul = document.getElementById("lista-audiencias");
  ul.innerHTML = "<li>Cargando audiencias...</li>";

  fetch(`${API_URL}?action=listarAudiencias&token=${API_TOKEN}&expediente_id=${encodeURIComponent(EXPEDIENTE_ID)}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      AUDIENCIAS_CACHE = data;
      renderAudiencias(data);
    })
    .catch(err => {
      console.error(err);
      ul.innerHTML = "<li class='empty'>No se pudieron cargar audiencias.</li>";
    });
}

function renderAudiencias(data) {
  const ul = document.getElementById("lista-audiencias");
  ul.innerHTML = "";
  
  if(!data || data.length === 0) {
    ul.innerHTML = "<li class='empty'>No hay audiencias registradas.</li>";
    return;
  }

  const ahora = new Date();
  
  // Filtrado en cliente
  let filtradas = data;
  if (FILTRO_AUDIENCIAS === 'proximas') {
    filtradas = data.filter(a => new Date(a[2]) >= ahora);
  } else if (FILTRO_AUDIENCIAS === 'pasadas') {
    filtradas = data.filter(a => new Date(a[2]) < ahora);
  }

  // Ordenar: más recientes primero o más próximas primero
  filtradas.sort((a, b) => new Date(a[2]) - new Date(b[2]));

  filtradas.forEach(a => {
    // a[2] = Fecha ISO
    const li = document.createElement("li");
    const fechaObj = new Date(a[2]);
    const esPasada = fechaObj < ahora;
    const diasDiferencia = (fechaObj - ahora) / (1000 * 60 * 60 * 24);
    const esCercana = diasDiferencia >= 0 && diasDiferencia <= 7;
    
    // Formateo de fecha legible
    const fechaStr = fechaObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const horaStr = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    li.className = `audiencia-item ${esPasada ? 'pasada' : ''} ${esCercana ? 'cercana' : ''}`;
    
    li.innerHTML = `
      <div class="audiencia-header">
        <span class="audiencia-fecha">📅 ${fechaStr} - ${horaStr}</span>
        ${esCercana ? '<span class="badge-recordatorio">Próxima</span>' : ''}
        ${esPasada ? '<span class="badge-pasada">Pasada</span>' : ''}
      </div>
      <div class="audiencia-tipo"><strong>${a[3]}</strong></div>
      ${a[4] ? `<div class="audiencia-desc">${a[4]}</div>` : ''}
      ${ROL === "admin" ? `<button class="btn-danger btn-small" onclick="eliminarAudiencia('${a[0]}')">Eliminar</button>` : ''}
    `;
    ul.appendChild(li);
  });
}

function crearAudiencia() {
  if (!EXPEDIENTE_ID) {
    mostrarToast("Seleccioná un expediente primero", "warning");
    return;
  }

  const fecha = document.getElementById("fecha-audiencia").value;
  const hora = document.getElementById("hora-audiencia").value;
  const tipo = document.getElementById("tipo-audiencia").value;
  const descripcion = document.getElementById("descripcion-audiencia").value;

  if (!fecha || !hora) {
    mostrarToast("Falta fecha u hora", "warning");
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.innerText = "Guardando...";

  // Construir ISO string simple
  const fechaHora = `${fecha}T${hora}:00`;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      token: API_TOKEN,
      action: "crearAudiencia",
      expediente_id: EXPEDIENTE_ID,
      fecha_hora: fechaHora,
      tipo: tipo,
      descripcion: descripcion,
      email: USUARIO
    })
  })
  .then(r => r.json())
  .then(resp => {
    if(resp.error) throw new Error(resp.error);
    
    // Reset campos
    document.getElementById("descripcion-audiencia").value = "";
    mostrarToast("Audiencia agendada", "success");
    cargarAudiencias();
  })
  .catch(e => mostrarToast("Error: " + e.message, "error"))
  .finally(() => {
    btn.disabled = false;
    btn.innerText = "+ Agregar Audiencia";
  });
}

function eliminarAudiencia(id) {
  if (ROL !== "admin") return;
  if(!confirm("¿Eliminar esta audiencia?")) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      token: API_TOKEN,
      action: "eliminarAudiencia",
      audiencia_id: id,
      email: USUARIO
    })
  })
  .then(r => r.json())
  .then(data => {
    if(data.error) throw new Error(data.error);
    mostrarToast("Audiencia eliminada", "success");
    cargarAudiencias();
  })
  .catch(err => mostrarToast("Error: " + err.message, "error"));
}

function filtrarAudiencias(filtro) {
  FILTRO_AUDIENCIAS = filtro;
  
  // Actualizar botones visualmente
  document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  // Re-renderizar con el caché local
  renderAudiencias(AUDIENCIAS_CACHE);
}

/************ RECORDATORIOS & AUDITORIA ************/
function verificarRecordatorios() {
  fetch(`${API_URL}?action=listarTodasAudiencias&token=${API_TOKEN}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) return;
      
      const ahora = new Date();
      const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const proximas = data.filter(a => {
        const f = new Date(a[2]);
        return f >= ahora && f <= en7Dias;
      });
      
      const badge = document.getElementById("recordatorios-badge");
      if (badge) {
        if (proximas.length > 0) {
          badge.textContent = `${proximas.length} 🔔`;
          badge.style.display = "inline-block";
          badge.onclick = () => mostrarModalRecordatorios(proximas);
        } else {
          badge.style.display = "none";
        }
      }
    })
    .catch(e => console.error("Error recordatorios:", e));
}

function mostrarModalRecordatorios(lista) {
  const modal = document.getElementById("modal-recordatorios");
  const ul = document.getElementById("lista-recordatorios");
  if(!modal || !ul) return;
  
  ul.innerHTML = "";
  lista.forEach(a => {
    const li = document.createElement("li");
    const fecha = new Date(a[2]);
    li.innerHTML = `<strong>${a[3]}</strong> <br> ${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}`;
    ul.appendChild(li);
  });
  
  modal.style.display = "flex";
}

function cerrarModalRecordatorios() {
  document.getElementById("modal-recordatorios").style.display = "none";
}

function cargarAuditoriaExpediente() {
  if (!EXPEDIENTE_ID) return;
  const ul = document.getElementById("auditoria-expediente");
  ul.innerHTML = "<li>Cargando...</li>";

  fetch(`${API_URL}?action=listarAuditoriaExpediente&token=${API_TOKEN}&expediente_id=${EXPEDIENTE_ID}`)
    .then(r => r.json())
    .then(data => {
      ul.innerHTML = "";
      if(!data || data.length === 0) {
        ul.innerHTML = "<li>Sin movimientos.</li>";
        return;
      }
      data.forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<small>${new Date(a[0]).toLocaleDateString()}</small> - <strong>${a[2]}</strong>: ${a[3]}`;
        ul.appendChild(li);
      });
    });
}

function cargarAuditoriaGeneral() {
  if (ROL !== "admin") return;
  const ul = document.getElementById("auditoria-general");
  ul.innerHTML = "<li>Cargando...</li>";

  fetch(`${API_URL}?action=listarAuditoria&token=${API_TOKEN}`)
    .then(r => r.json())
    .then(data => {
      ul.innerHTML = "";
      data.slice(0, 50).forEach(a => { // Limitar a los ultimos 50
        const li = document.createElement("li");
        li.innerHTML = `<small>${new Date(a[0]).toLocaleString()}</small> <strong>${a[1]}</strong>: ${a[2]}`;
        ul.appendChild(li);
      });
    });
}