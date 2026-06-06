// Keep the Rust surface minimal (PLAN.md): plugins only, no custom commands yet.
// File access rules are enforced by capabilities/default.json — read-only until M3.

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
