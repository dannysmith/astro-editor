use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
#[specta::specta]
pub async fn copy_text_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("Failed to copy to clipboard: {e}"))
}

/// The clipboard's text, for Paste as Plain Text. Read here because the
/// webview's own `navigator.clipboard.readText()` asks for permission first
#[tauri::command]
#[specta::specta]
pub async fn read_text_from_clipboard(app: tauri::AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| format!("Failed to read the clipboard: {e}"))
}
