use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{AppHandle, Emitter};
use std::collections::HashMap;

#[tauri::command]
async fn start_oauth_server(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    tauri::async_runtime::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]);

            if let Some(line) = request.lines().next() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let path = parts[1];
                    let callback_url = format!("http://localhost:{}{}", port, path);

                    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                        <html><body style='font-family:sans-serif;text-align:center;padding:40px'>\
                        <h2>Login exitoso</h2><p>Puedes cerrar esta ventana.</p>\
                        <script>window.close()</script></body></html>";
                    let _ = stream.write_all(response.as_bytes());

                    let _ = app.emit("oauth-callback", callback_url);
                }
            }
        }
    });

    Ok(port)
}

#[tauri::command]
async fn exchange_oauth_code(
    code: String,
    code_verifier: String,
    redirect_uri: String,
    client_id: String,
    client_secret: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("code", code.as_str());
    params.insert("code_verifier", code_verifier.as_str());
    params.insert("redirect_uri", redirect_uri.as_str());
    params.insert("client_id", client_id.as_str());
    params.insert("client_secret", client_secret.as_str());
    params.insert("grant_type", "authorization_code");

    let res = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![start_oauth_server, exchange_oauth_code])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
