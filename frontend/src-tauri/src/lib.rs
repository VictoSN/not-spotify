#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
