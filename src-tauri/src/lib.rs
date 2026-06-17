#[cfg(desktop)]
use std::io::{Read, Write};
#[cfg(desktop)]
use std::net::TcpListener;
#[cfg(desktop)]
use tauri::{AppHandle, Emitter};

#[cfg(desktop)]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![start_oauth_server]);

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
