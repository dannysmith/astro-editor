/// Opens macOS's Emoji & Symbols palette. It inserts the chosen emoji into the
/// focused text input, so the caller focuses one first. Other platforms have
/// no palette that can be opened from code, so this does nothing there.
#[tauri::command]
#[specta::specta]
pub fn open_emoji_palette() {
    #[cfg(target_os = "macos")]
    dispatch2::DispatchQueue::main().exec_async(|| {
        let mtm = objc2::MainThreadMarker::new().expect("the main queue runs on the main thread");
        objc2_app_kit::NSApplication::sharedApplication(mtm).orderFrontCharacterPalette(None);
    });
}
