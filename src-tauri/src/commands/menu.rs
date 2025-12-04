use std::sync::Mutex;
use tauri::Manager;

use crate::MenuState;

#[tauri::command]
#[specta::specta]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[tauri::command]
#[specta::specta]
pub async fn update_format_menu_state(
    app_handle: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    // Try to enable/disable menu items using stored references
    if let Some(menu_state) = app_handle.try_state::<Mutex<MenuState>>() {
        if let Ok(state) = menu_state.lock() {
            for item in state.format_items.values() {
                let _ = item.set_enabled(enabled);
            }
        }
    }

    Ok(())
}
