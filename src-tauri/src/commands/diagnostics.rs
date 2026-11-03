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
