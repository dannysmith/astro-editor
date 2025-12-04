use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_platform_info() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_app_info() -> Result<AppInfo, String> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
    })
}
