use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

const OFFLINE_MAGIC: &[u8; 5] = b"NSOA1";
const OFFLINE_SERVICE: &str = "com.notspotify.desktop.offline-audio";
const OFFLINE_ACCOUNT: &str = "device-key";

fn offline_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("offline"))
        .map_err(|error| error.to_string())
}

fn safe_offline_path(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    // The webview must never turn this protocol into a general local-file reader.
    if !relative.starts_with("offline/")
        || relative.contains("..")
        || Path::new(relative).components().count() != 2
        || !relative.ends_with(".nsa")
    {
        return Err("invalid offline audio path".into());
    }
    app.path()
        .app_local_data_dir()
        .map(|root| root.join(relative))
        .map_err(|error| error.to_string())
}

fn offline_key() -> Result<[u8; 32], String> {
    let entry = keyring::Entry::new(OFFLINE_SERVICE, OFFLINE_ACCOUNT)
        .map_err(|error| format!("could not access the OS credential store: {error}"))?;
    match entry.get_password() {
        Ok(value) => {
            let decoded = BASE64.decode(value).map_err(|_| "offline key is invalid")?;
            decoded
                .try_into()
                .map_err(|_| "offline key has an invalid length".into())
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = [0_u8; 32];
            OsRng.fill_bytes(&mut key);
            entry.set_password(&BASE64.encode(key)).map_err(|error| {
                format!("could not save the offline key in the OS credential store: {error}")
            })?;
            Ok(key)
        }
        Err(error) => Err(format!(
            "could not read the offline key from the OS credential store: {error}"
        )),
    }
}

fn encrypt_offline_audio(key: &[u8; 32], mime: &str, bytes: &[u8]) -> Result<Vec<u8>, String> {
    if mime.len() > u16::MAX as usize {
        return Err("audio content type is too long".into());
    }
    let mut header = Vec::with_capacity(OFFLINE_MAGIC.len() + 2 + mime.len());
    header.extend_from_slice(OFFLINE_MAGIC);
    header.extend_from_slice(&(mime.len() as u16).to_be_bytes());
    header.extend_from_slice(mime.as_bytes());
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|_| "could not initialize offline encryption")?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: bytes,
                aad: &header,
            },
        )
        .map_err(|_| "could not encrypt offline audio")?;
    header.extend_from_slice(&nonce);
    header.extend_from_slice(&ciphertext);
    Ok(header)
}

fn decrypt_offline_audio(bytes: &[u8]) -> Result<(String, Vec<u8>), String> {
    if bytes.len() < OFFLINE_MAGIC.len() + 2 + 12 || &bytes[..OFFLINE_MAGIC.len()] != OFFLINE_MAGIC
    {
        return Err("offline audio file is not valid".into());
    }
    let mime_len = u16::from_be_bytes([bytes[5], bytes[6]]) as usize;
    let header_end = 7 + mime_len;
    if bytes.len() < header_end + 12 + 16 {
        return Err("offline audio file is incomplete".into());
    }
    let mime = std::str::from_utf8(&bytes[7..header_end])
        .map_err(|_| "offline audio type is invalid")?
        .to_owned();
    let key = offline_key()?;
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|_| "could not initialize offline encryption")?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&bytes[header_end..header_end + 12]),
            Payload {
                msg: &bytes[header_end + 12..],
                aad: &bytes[..header_end],
            },
        )
        .map_err(|_| "offline audio cannot be decrypted on this device")?;
    Ok((mime, plaintext))
}

fn parse_range(value: Option<&http::HeaderValue>, total: usize) -> Option<(usize, usize)> {
    let range = value?.to_str().ok()?.strip_prefix("bytes=")?;
    let (start, end) = range.split_once('-')?;
    let start = start.parse::<usize>().ok()?;
    if start >= total {
        return None;
    }
    let end = if end.is_empty() {
        total - 1
    } else {
        end.parse::<usize>().ok()?.min(total - 1)
    };
    (start <= end).then_some((start, end))
}

/// Saves encrypted bytes only. The AES key is held by the current OS user's
/// credential store, so copying an `.nsa` file to another machine/user account
/// does not produce a playable audio file.
#[tauri::command]
fn save_offline_audio(
    app: AppHandle,
    path: String,
    mime: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let target = safe_offline_path(&app, &path)?;
    fs::create_dir_all(offline_dir(&app)?).map_err(|error| error.to_string())?;
    let encrypted = encrypt_offline_audio(&offline_key()?, &mime, &bytes)?;
    fs::write(target, encrypted).map_err(|error| error.to_string())
}

/// IPC fallback for WebView media stacks that cannot decode the custom protocol.
/// The response is raw bytes (not a JSON number array), so even large tracks cross
/// the native boundary without the serialization overhead of `Vec<u8>`.
#[tauri::command]
fn read_offline_audio(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    let source = safe_offline_path(&app, &path)?;
    let encrypted = fs::read(source).map_err(|error| error.to_string())?;
    let (_, audio) = decrypt_offline_audio(&encrypted)?;
    Ok(tauri::ipc::Response::new(audio))
}

// Build + show a Windows toast directly. Lets us render the sender's avatar as a
// circular app-logo (the high-level notification plugin can't show images on
// Windows). `icon` is a path to a local image file (see cacheIconForTauri on the
// JS side).
#[cfg(windows)]
fn show_toast(app_id: &str, title: &str, body: &str, icon: Option<&str>) -> Result<(), String> {
    use std::path::Path;
    use tauri_winrt_notification::{IconCrop, Toast};

    let mut toast = Toast::new(app_id).title(title).text1(body);
    if let Some(path) = icon {
        if !path.is_empty() && Path::new(path).exists() {
            toast = toast.icon(Path::new(path), IconCrop::Circular, "avatar");
        }
    }
    toast.show().map_err(|e| e.to_string())
}

/// Native OS notification with an optional avatar image. Windows-only; other
/// platforms fall back to the notification plugin on the JS side.
#[tauri::command]
fn notify_native(title: String, body: String, icon: Option<String>) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri_winrt_notification::Toast;
        // In dev there's no installed Start-Menu shortcut registering our AUMID,
        // so toasts must go out under PowerShell's AppID (still renders the
        // avatar). The installed release build uses our own branded identity.
        let app_id = if cfg!(debug_assertions) {
            Toast::POWERSHELL_APP_ID
        } else {
            "com.notspotify.desktop"
        };
        show_toast(app_id, &title, &body, icon.as_deref())
    }
    #[cfg(not(windows))]
    {
        let _ = (title, body, icon);
        Err("notify_native is Windows-only".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("offline-audio", |context, request| {
            // WebView2 requests custom media through the CORS pipeline because
            // the player uses a MediaElementAudioSourceNode. Handle its preflight
            // explicitly before trying to interpret a media path.
            if request.method() == http::Method::OPTIONS {
                return http::Response::builder()
                    .status(http::StatusCode::NO_CONTENT)
                    .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .header(
                        http::header::ACCESS_CONTROL_ALLOW_METHODS,
                        "GET, HEAD, OPTIONS",
                    )
                    .header(
                        http::header::ACCESS_CONTROL_ALLOW_HEADERS,
                        "Range, Content-Type",
                    )
                    .header(http::header::ACCESS_CONTROL_MAX_AGE, "86400")
                    .body(Vec::new())
                    .unwrap();
            }
            let path = format!("offline{}", request.uri().path());
            let result = safe_offline_path(context.app_handle(), &path)
                .and_then(|path| fs::read(path).map_err(|error| error.to_string()))
                .and_then(|bytes| decrypt_offline_audio(&bytes));
            match result {
                Ok((mime, audio)) => {
                    if let Some((start, end)) =
                        parse_range(request.headers().get(http::header::RANGE), audio.len())
                    {
                        http::Response::builder()
                            .status(http::StatusCode::PARTIAL_CONTENT)
                            .header(http::header::CONTENT_TYPE, mime)
                            .header(http::header::ACCEPT_RANGES, "bytes")
                            // The Web Audio graph sets `crossOrigin=anonymous` on
                            // its decks. Explicit CORS lets WebView2 decode this
                            // private protocol as audio without exposing the file.
                            .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                            .header(
                                http::header::ACCESS_CONTROL_ALLOW_METHODS,
                                "GET, HEAD, OPTIONS",
                            )
                            .header(
                                http::header::ACCESS_CONTROL_ALLOW_HEADERS,
                                "Range, Content-Type",
                            )
                            .header(
                                http::header::ACCESS_CONTROL_EXPOSE_HEADERS,
                                "Accept-Ranges, Content-Length, Content-Range",
                            )
                            .header(
                                http::header::CONTENT_RANGE,
                                format!("bytes {start}-{end}/{}", audio.len()),
                            )
                            .header(http::header::CONTENT_LENGTH, end - start + 1)
                            .body(audio[start..=end].to_vec())
                            .unwrap()
                    } else {
                        http::Response::builder()
                            .header(http::header::CONTENT_TYPE, mime)
                            .header(http::header::ACCEPT_RANGES, "bytes")
                            .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                            .header(
                                http::header::ACCESS_CONTROL_ALLOW_METHODS,
                                "GET, HEAD, OPTIONS",
                            )
                            .header(
                                http::header::ACCESS_CONTROL_ALLOW_HEADERS,
                                "Range, Content-Type",
                            )
                            .header(
                                http::header::ACCESS_CONTROL_EXPOSE_HEADERS,
                                "Accept-Ranges, Content-Length, Content-Range",
                            )
                            .header(http::header::CONTENT_LENGTH, audio.len())
                            .body(audio)
                            .unwrap()
                    }
                }
                Err(error) => http::Response::builder()
                    .status(http::StatusCode::NOT_FOUND)
                    .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    // Kept intentionally terse: useful in DevTools without
                    // exposing plaintext or key material.
                    .header("X-Offline-Audio-Error", error)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            notify_native,
            save_offline_audio,
            read_offline_audio
        ])
        .setup(|app| {
            // Force-strip the native window chrome at runtime so we always render
            // the in-app titlebar (WindowControls). Belt-and-suspenders alongside
            // `decorations: false` in tauri.conf.json.
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running not-spotify desktop");
}
