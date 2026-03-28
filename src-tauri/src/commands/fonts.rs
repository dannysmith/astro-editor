/// Detect the user's configured UI font on Linux.
///
/// Tries gsettings (GNOME/Cinnamon/Budgie/XFCE) first, then falls back to
/// reading KDE's kdeglobals config file. Returns None if neither works or
/// if not running on Linux.
#[tauri::command]
#[specta::specta]
pub async fn get_linux_ui_font() -> Result<Option<String>, String> {
    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }

    #[cfg(target_os = "linux")]
    {
        // Try gsettings (GNOME, Cinnamon, Budgie, most XFCE setups)
        if let Some(font) = read_gsettings_font() {
            return Ok(Some(font));
        }

        // Try KDE's kdeglobals config
        if let Some(font) = read_kde_font() {
            return Ok(Some(font));
        }

        Ok(None)
    }
}

#[cfg(target_os = "linux")]
fn read_gsettings_font() -> Option<String> {
    use std::process::Command;

    let output = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "font-name"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let raw = String::from_utf8(output.stdout).ok()?;
    parse_gsettings_font(&raw)
}

#[cfg(target_os = "linux")]
fn parse_gsettings_font(raw: &str) -> Option<String> {
    // gsettings returns e.g. "'Ubuntu 11'" or "'Noto Sans 10'"
    // Strip quotes and trailing size number
    let trimmed = raw.trim().trim_matches('\'');
    if trimmed.is_empty() {
        return None;
    }

    // Split off the trailing number (font size) if present
    // e.g. "Ubuntu 11" → "Ubuntu", "Noto Sans CJK SC 10" → "Noto Sans CJK SC"
    match trimmed.rsplit_once(' ') {
        Some((name, maybe_size)) if maybe_size.parse::<f32>().is_ok() => {
            let name = name.trim();
            if name.is_empty() {
                None
            } else {
                Some(name.to_string())
            }
        }
        _ => Some(trimmed.to_string()),
    }
}

#[cfg(target_os = "linux")]
fn read_kde_font() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = std::path::Path::new(&home).join(".config/kdeglobals");
    let content = std::fs::read_to_string(path).ok()?;

    parse_kde_font(&content)
}

#[cfg(target_os = "linux")]
fn parse_kde_font(content: &str) -> Option<String> {
    // kdeglobals format:
    // [General]
    // font=Noto Sans,10,-1,5,50,0,0,0,0,0
    let mut in_general = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "[General]" {
            in_general = true;
            continue;
        }
        if trimmed.starts_with('[') {
            in_general = false;
            continue;
        }
        if in_general {
            if let Some(value) = trimmed.strip_prefix("font=") {
                // Take the first comma-separated field (the font family name)
                let font_name = value.split(',').next()?.trim();
                if font_name.is_empty() {
                    return None;
                }
                return Some(font_name.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "linux")]
    use super::*;

    #[cfg(target_os = "linux")]
    #[test]
    fn test_parse_gsettings_font() {
        assert_eq!(
            parse_gsettings_font("'Ubuntu 11'\n"),
            Some("Ubuntu".to_string())
        );
        assert_eq!(
            parse_gsettings_font("'Noto Sans 10'\n"),
            Some("Noto Sans".to_string())
        );
        assert_eq!(
            parse_gsettings_font("'Cantarell 11'\n"),
            Some("Cantarell".to_string())
        );
        assert_eq!(
            parse_gsettings_font("'Noto Sans CJK SC 10'\n"),
            Some("Noto Sans CJK SC".to_string())
        );
        // No size suffix
        assert_eq!(parse_gsettings_font("'Inter'\n"), Some("Inter".to_string()));
        // Empty
        assert_eq!(parse_gsettings_font("''\n"), None);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_parse_kde_font() {
        let content = "\
[General]
font=Noto Sans,10,-1,5,50,0,0,0,0,0
fixed=Hack,10,-1,5,50,0,0,0,0,0

[Icons]
Theme=breeze
";
        assert_eq!(parse_kde_font(content), Some("Noto Sans".to_string()));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_parse_kde_font_missing() {
        let content = "\
[Icons]
Theme=breeze
";
        assert_eq!(parse_kde_font(content), None);
    }
}
