//! HEIC photos (what iPhones take) are converted to JPEG as they're added to a
//! project. Astro can't use HEIC: it isn't one of its image formats, Vite
//! won't import it, and Sharp's prebuilt binaries can't decode it. Only
//! Safari shows one in an `<img>`.

use std::path::Path;

/// Whether `path` is a HEIC or HEIF image, by its extension
pub fn is_heic(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("heic") || ext.eq_ignore_ascii_case("heif"))
}

/// Writes the HEIC image `source` to `dest` as a JPEG, with macOS's own
/// decoder through `sips`. The photo's orientation is kept as it is, in its
/// EXIF data, which browsers and Sharp both follow.
#[cfg(target_os = "macos")]
pub fn convert_to_jpeg(source: &Path, dest: &Path) -> Result<(), String> {
    use crate::process;
    use std::process::Command;
    use std::time::Duration;

    const TIMEOUT: Duration = Duration::from_secs(30);
    let failed = "Couldn't convert the HEIC image to JPEG";

    let mut convert = Command::new("/usr/bin/sips");
    convert
        .args(["-s", "format", "jpeg", "-s", "formatOptions", "high"])
        .arg(source)
        .arg("--out")
        .arg(dest);
    let finished = process::run(&mut convert, TIMEOUT).map_err(|_| failed.to_string())?;
    if !finished.status.success() {
        let reason = String::from_utf8_lossy(&finished.stderr);
        return Err(format!("{failed}: {}", reason.trim()));
    }

    // When it can't reach the decoder (in a sandbox, say), sips still exits
    // 0, having written a JPEG with no pixels in it
    let mut measure = Command::new("/usr/bin/sips");
    measure.args(["-g", "pixelWidth"]).arg(dest);
    let measured = process::run(&mut measure, TIMEOUT).map_err(|_| failed.to_string())?;
    let has_pixels = String::from_utf8_lossy(&measured.stdout)
        .lines()
        .filter_map(|line| line.trim().strip_prefix("pixelWidth: "))
        .any(|width| width.parse::<u32>().is_ok_and(|width| width > 0));
    if !has_pixels {
        return Err(failed.to_string());
    }
    Ok(())
}

/// Only macOS can convert HEIC without bundling a decoder
#[cfg(not(target_os = "macos"))]
pub fn convert_to_jpeg(_source: &Path, _dest: &Path) -> Result<(), String> {
    Err("HEIC images can't be used by Astro. Convert it to JPEG first.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_heic_and_heif_in_any_case() {
        assert!(is_heic(Path::new("/photos/IMG_1234.HEIC")));
        assert!(is_heic(Path::new("photo.heif")));
        assert!(!is_heic(Path::new("photo.jpg")));
        assert!(!is_heic(Path::new("heic")));
    }

    #[test]
    fn a_file_that_isnt_an_image_fails() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("photo.heic");
        std::fs::write(&source, b"not an image").unwrap();
        assert!(convert_to_jpeg(&source, &dir.path().join("photo.jpg")).is_err());
    }

    // Sandboxes (like an AI agent's) block the decoder, so this is run by
    // hand on a Mac: `cargo test heic -- --ignored`
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore = "needs macOS's HEVC decoder"]
    fn converts_a_heic_photo() {
        let dir = tempfile::TempDir::new().unwrap();
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/images/photo.heic");
        let dest = dir.path().join("photo.jpg");
        convert_to_jpeg(&source, &dest).unwrap();
        let jpeg = std::fs::read(&dest).unwrap();
        assert_eq!(jpeg[..3], [0xFF, 0xD8, 0xFF]);
    }
}
