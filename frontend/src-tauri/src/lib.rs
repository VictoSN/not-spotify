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
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![notify_native])
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
