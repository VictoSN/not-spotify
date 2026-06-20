// Prevents an extra console window from opening on Windows in release builds.
// Do not remove — without it the packaged app spawns a stray terminal.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    not_spotify_desktop_lib::run()
}
