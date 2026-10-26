//! Webview snapshots for the agent bridge.
//!
//! On macOS this uses `WKWebView.takeSnapshot`, which needs no Screen Recording
//! permission and doesn't raise or focus the window. It only captures the webview,
//! so the vibrancy behind transparent areas comes out transparent.

use std::path::Path;
use tauri::WebviewWindow;

/// Writes a PNG of the webview to `path` and returns its size in pixels.
#[cfg(target_os = "macos")]
pub fn capture(window: &WebviewWindow, path: &Path) -> Result<(isize, isize), String> {
    use block2::RcBlock;
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSImage;
    use objc2_foundation::NSError;
    use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};
    use std::sync::mpsc;
    use std::time::Duration;

    let (tx, rx) = mpsc::channel::<Result<(Vec<u8>, isize, isize), String>>();
    window
        .with_webview(move |webview| {
            let mtm = MainThreadMarker::new().expect("with_webview runs on the main thread");
            // SAFETY: on macOS, `inner()` is the WKWebView that wry created for this window
            let wk_webview: &WKWebView = unsafe { &*webview.inner().cast() };
            let config = unsafe { WKSnapshotConfiguration::new(mtm) };
            let handler = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
                // SAFETY: WebKit passes either a valid image or a valid error
                let result = match unsafe { image.as_ref() } {
                    Some(image) => png_data(image),
                    None => Err(unsafe { error.as_ref() }
                        .map(|e| e.localizedDescription().to_string())
                        .unwrap_or_else(|| "snapshot failed".to_string())),
                };
                let _ = tx.send(result);
            });
            unsafe {
                wk_webview.takeSnapshotWithConfiguration_completionHandler(Some(&config), &handler)
            };
        })
        .map_err(|e| e.to_string())?;

    let (png, width, height) = rx
        .recv_timeout(Duration::from_secs(10))
        .map_err(|_| "snapshot timed out")??;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, png).map_err(|e| e.to_string())?;
    Ok((width, height))
}

#[cfg(target_os = "macos")]
fn png_data(image: &objc2_app_kit::NSImage) -> Result<(Vec<u8>, isize, isize), String> {
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep};
    use objc2_foundation::NSDictionary;

    let tiff = image
        .TIFFRepresentation()
        .ok_or("snapshot has no image data")?;
    let rep = NSBitmapImageRep::imageRepWithData(&tiff).ok_or("couldn't read snapshot")?;
    // SAFETY: an empty properties dictionary is valid for every file type
    let png = unsafe {
        rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
    }
    .ok_or("couldn't encode PNG")?;
    Ok((png.to_vec(), rep.pixelsWide(), rep.pixelsHigh()))
}

#[cfg(not(target_os = "macos"))]
pub fn capture(_window: &WebviewWindow, _path: &Path) -> Result<(isize, isize), String> {
    Err("snapshots are only implemented on macOS".to_string())
}
