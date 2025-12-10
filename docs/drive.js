// =========================================
// DRIVE.JS - Backup en Google Drive
// =========================================

let accessToken = null;
let folderId = null;

// Obtener token OAuth completo
function obtenerToken() {
    return new Promise(resolve => {
        google.accounts.oauth2.initTokenClient({
            client_id: "813716685470-a4t8hcof0uipjal7kv66nam68pab4de5.apps.googleusercontent.com",
            scope: "https://www.googleapis.com/auth/drive.file",
            callback: (resp) => {
                accessToken = resp.access_token;
                resolve(resp.access_token);
            }
        }).requestAccessToken();
    });
}

// Verificar/crear carpeta "Expedientes Legales"
async function verificarCarpeta() {
    if (!accessToken) await obtenerToken();

    let res = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='Expedientes Legales' and mimeType='application/vnd.google-apps.folder'",
        { headers: { Authorization: "Bearer " + accessToken } }
    );

    let data = await res.json();

    if (data.files && data.files.length > 0) {
        folderId = data.files[0].id;
        return;
    }

    // Crear carpeta
    let crear = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: "Expedientes Legales",
            mimeType: "application/vnd.google-apps.folder"
        })
    });

    let nueva = await crear.json();
    folderId = nueva.id;
}

// Subir backup a Drive
async function subirBackupDrive() {
    await verificarCarpeta();

    let data = {
        clientes: await db.transaction("clientes","readonly").objectStore("clientes").getAll(),
        expedientes: await db.transaction("expedientes","readonly").objectStore("expedientes").getAll(),
        documentos: await db.transaction("documentos","readonly").objectStore("documentos").getAll()
    };

    let contenido = JSON.stringify(data);

    let metadata = {
        name: "backup_expedientes.json",
        parents: [folderId]
    };

    let boundary = "xxxxxxxxxx";
    let body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) + "\r\n" +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        contenido + "\r\n" +
        `--${boundary}--`;

    await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: {
                Authorization: "Bearer " + accessToken,
                "Content-Type": "multipart/related; boundary=" + boundary
            },
            body
        }
    );

    document.getElementById("driveStatus").innerHTML = "Backup subido correctamente.";
}

// Descargar y restaurar backup desde Drive
async function descargarBackupDrive() {
    await verificarCarpeta();

    let res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='backup_expedientes.json' and '${folderId}' in parents`,
        { headers: { Authorization: "Bearer " + accessToken } }
    );

    let data = await res.json();
    if (!data.files || data.files.length === 0) {
        alert("No hay backup en Drive");
        return;
    }

    let fileId = data.files[0].id;

    let download = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: "Bearer " + accessToken } }
    );

    let json = await download.json();

    let trans = db.transaction(["clientes","expedientes","documentos"], "readwrite");
    trans.objectStore("clientes").clear();
    trans.objectStore("expedientes").clear();
    trans.objectStore("documentos").clear();

    json.clientes.forEach(c => trans.objectStore("clientes").add(c));
    json.expedientes.forEach(e => trans.objectStore("expedientes").add(e));
    json.documentos.forEach(d => trans.objectStore("documentos").add(d));

    trans.oncomplete = () => {
        alert("Backup restaurado desde Drive.");
        cargarClientes();
        cargarExpedientes();
        cargarDocumentos();
    };
}
