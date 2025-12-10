// DRIVE.JS

let accessToken = null;

function getAccessToken() {
    return new Promise((resolve) => {
        google.accounts.oauth2.initTokenClient({
            client_id: "813716685470-a4t8hcof0uipjal7kv66nam68pab4de5.apps.googleusercontent.com",
            scope: "https://www.googleapis.com/auth/drive.file",
            callback: (tokenResponse) => {
                accessToken = tokenResponse.access_token;
                resolve(accessToken);
            }
        }).requestAccessToken();
    });
}

async function exportBackupDrive() {
    await getAccessToken();

    const backup = await generarBackupJSON();

    const metadata = {
        name: "backup_expedientes.json",
        mimeType: "application/json"
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([backup], { type: "application/json" }));

    await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    });

    alert("Backup subido a Google Drive");
}

async function importarBackupDrive() {
    await getAccessToken();

    const res = await fetch("https://www.googleapis.com/drive/v3/files?q=name='backup_expedientes.json'&fields=files(id)", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await res.json();
    if (!data.files || data.files.length === 0) return alert("No se encontró backup");

    const fileId = data.files[0].id;

    const fileContent = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json());

    restaurarBackupJSON(fileContent);
}

