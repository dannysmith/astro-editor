use log::{debug, error, info, warn};
use std::env;
use std::process::Command;

/// The list of allowed IDE commands for security
const ALLOWED_IDES: &[&str] = &["cursor", "code", "vim", "nvim", "emacs", "subl"];

/// Compute an augmented PATH with common IDE locations for production builds.
/// Returns the augmented PATH string to be passed to Command::new().env("PATH", ...).
/// This is thread-safe unlike env::set_var which is deprecated since Rust 1.80.
fn get_augmented_path() -> String {
    #[cfg(target_os = "macos")]
    {
        let current_path = env::var("PATH").unwrap_or_default();
        let mut paths: Vec<&str> = current_path.split(':').collect();

        // Common paths that might be missing in production builds on macOS
        let common_paths = [
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/usr/bin",
            "/bin",
            "/opt/local/bin", // MacPorts
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin",
            "/Applications/Cursor.app/Contents/Resources/app/bin",
        ];

        for common_path in &common_paths {
            if !paths.contains(common_path) {
                paths.push(common_path);
            }
        }

        let augmented = paths.join(":");
        debug!("Augmented PATH for IDE execution: {augmented}");
        augmented
    }

    #[cfg(target_os = "windows")]
    {
        let current_path = env::var("PATH").unwrap_or_default();
        let mut paths: Vec<String> = current_path.split(';').map(String::from).collect();

        // System-wide install locations
        let mut common_paths = vec![
            r"C:\Program Files\Microsoft VS Code\bin".to_string(),
            r"C:\Program Files\Cursor\resources\app\bin".to_string(),
        ];

        // User-specific install locations (VS Code per-user install)
        if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            common_paths.push(format!(r"{local_app_data}\Programs\Microsoft VS Code\bin"));
            common_paths.push(format!(
                r"{local_app_data}\Programs\cursor\resources\app\bin"
            ));
        }

        for common_path in &common_paths {
            if !paths.contains(common_path) {
                paths.push(common_path.clone());
            }
        }

        let augmented = paths.join(";");
        debug!("Augmented PATH for IDE execution: {augmented}");
        augmented
    }

    #[cfg(target_os = "linux")]
    {
        let current_path = env::var("PATH").unwrap_or_default();
        let mut paths: Vec<String> = current_path.split(':').map(String::from).collect();

        // System-wide paths
        let mut common_paths = vec![
            "/usr/local/bin".to_string(),
            "/usr/bin".to_string(),
            "/bin".to_string(),
            "/snap/bin".to_string(),                    // Snap packages
            "/var/lib/flatpak/exports/bin".to_string(), // System Flatpak
            "/opt/visual-studio-code/bin".to_string(),  // Some distros
        ];

        // User-specific paths
        if let Ok(home) = env::var("HOME") {
            common_paths.push(format!("{home}/.local/bin")); // User local bin
            common_paths.push(format!("{home}/.local/share/flatpak/exports/bin"));
            // User Flatpak
        }

        for common_path in &common_paths {
            if !paths.contains(common_path) {
                paths.push(common_path.clone());
            }
        }

        let augmented = paths.join(":");
        debug!("Augmented PATH for IDE execution: {augmented}");
        augmented
    }
}

/// Validates that an IDE command is in the allowed list
fn validate_ide_command(ide: &str) -> bool {
    ALLOWED_IDES.contains(&ide)
}

/// Checks if a path looks like a Windows absolute path (e.g., C:\, D:\)
#[cfg(any(target_os = "windows", test))]
fn is_windows_absolute_path(path: &str) -> bool {
    if path.len() >= 3 {
        let bytes = path.as_bytes();
        // Check for drive letter followed by :\ or :/
        bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && (bytes[2] == b'\\' || bytes[2] == b'/')
    } else {
        false
    }
}

/// Checks if a path is a UNC path (e.g., \\server\share)
fn is_unc_path(path: &str) -> bool {
    path.starts_with(r"\\") || path.starts_with("//")
}

/// Validates a file path for basic security
fn validate_file_path(path: &str) -> Result<(), String> {
    // Check for obviously malicious patterns (cross-platform)
    if path.contains("&&") || path.contains("||") || path.contains(';') || path.contains('|') {
        return Err("File path contains shell command separators".to_string());
    }

    if path.contains('`') || path.contains("$(") {
        return Err("File path contains command substitution".to_string());
    }

    // Reject UNC paths (network paths) - not supported for IDE opening
    if is_unc_path(path) {
        return Err("Network paths (UNC) are not supported for IDE opening".to_string());
    }

    // Platform-specific absolute path validation
    #[cfg(not(target_os = "windows"))]
    {
        // On Unix systems, paths should be absolute (start with / or ~)
        if !path.starts_with('/') && !path.starts_with('~') {
            return Err("File path must be absolute".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, accept drive letter paths (C:\, D:\, etc.) or paths starting with /
        // (some tools accept forward slashes on Windows)
        if !is_windows_absolute_path(path) && !path.starts_with('/') && !path.starts_with('~') {
            return Err("File path must be absolute (e.g., C:\\path\\to\\file)".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn open_path_in_ide(ide_command: String, file_path: String) -> Result<String, String> {
    info!("Attempting to open path in IDE: {ide_command} -> {file_path}");

    // Validate IDE command
    if !validate_ide_command(&ide_command) {
        let error_msg = format!("Invalid IDE command '{ide_command}'. Allowed: {ALLOWED_IDES:?}");
        error!("{error_msg}");
        return Err(error_msg);
    }

    // Validate file path
    if let Err(validation_error) = validate_file_path(&file_path) {
        let error_msg = format!("Invalid file path: {validation_error}");
        error!("{error_msg}");
        return Err(error_msg);
    }

    // Get augmented PATH for production builds (thread-safe, doesn't mutate global env)
    let augmented_path = get_augmented_path();

    info!("Executing IDE command: {ide_command} \"{file_path}\"");

    // Execute the command with augmented PATH (Command::new().arg() handles path escaping safely)
    let result = Command::new(&ide_command)
        .env("PATH", &augmented_path)
        .arg(&file_path)
        .output();

    match result {
        Ok(output) => {
            if output.status.success() {
                let success_msg = format!("Successfully opened '{file_path}' in {ide_command}");
                info!("{success_msg}");
                Ok(success_msg)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let error_msg = format!(
                    "IDE command failed with exit code {}: {}",
                    output.status.code().unwrap_or(-1),
                    stderr
                );
                error!("{error_msg}");
                Err(error_msg)
            }
        }
        Err(e) => {
            let error_msg = format!("Failed to execute IDE command '{ide_command}': {e}");
            error!("{error_msg}");

            // Provide helpful suggestions based on the error
            let suggestion = match e.kind() {
                std::io::ErrorKind::NotFound => {
                    format!(
                        "IDE '{ide_command}' not found. Make sure it's installed and available in PATH."
                    )
                }
                std::io::ErrorKind::PermissionDenied => {
                    "Permission denied. Check file permissions and IDE installation.".to_string()
                }
                _ => format!("System error: {e}"),
            };

            warn!("IDE execution suggestion: {suggestion}");
            Err(format!("{error_msg}\n\nSuggestion: {suggestion}"))
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_available_ides() -> Result<Vec<String>, String> {
    debug!("Checking available IDEs");

    // Get augmented PATH (thread-safe, doesn't mutate global env)
    let augmented_path = get_augmented_path();

    let mut available_ides = Vec::new();

    for ide in ALLOWED_IDES {
        // Try to execute the IDE with --version to see if it's available
        let check_result = Command::new(ide)
            .env("PATH", &augmented_path)
            .arg("--version")
            .output();

        match check_result {
            Ok(output) if output.status.success() => {
                info!("Found available IDE: {ide}");
                available_ides.push(ide.to_string());
            }
            Ok(_) => {
                warn!("IDE '{ide}' found but returned non-zero exit code");
            }
            Err(e) => {
                debug!("IDE '{ide}' not available: {e}");
            }
        }
    }

    info!("Available IDEs: {available_ides:?}");
    Ok(available_ides)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_ide_command() {
        assert!(validate_ide_command("code"));
        assert!(validate_ide_command("cursor"));
        assert!(validate_ide_command("vim"));
        assert!(validate_ide_command("nvim"));
        assert!(validate_ide_command("emacs"));
        assert!(validate_ide_command("subl"));

        assert!(!validate_ide_command("rm"));
        assert!(!validate_ide_command("cat"));
        assert!(!validate_ide_command(""));
        assert!(!validate_ide_command("code; rm -rf /"));
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_validate_file_path() {
        // Valid Unix paths
        assert!(validate_file_path("/home/user/file.txt").is_ok());
        assert!(validate_file_path("~/Documents/test.md").is_ok());

        // Invalid paths with command injection
        assert!(validate_file_path("/home/user/file.txt && rm -rf /").is_err());
        assert!(validate_file_path("/home/user/file.txt || cat /etc/passwd").is_err());
        assert!(validate_file_path("/home/user/file.txt; echo hello").is_err());
        assert!(validate_file_path("/home/user/file.txt | cat").is_err());
        assert!(validate_file_path("/home/user/file`echo test`.txt").is_err());
        assert!(validate_file_path("/home/user/file$(whoami).txt").is_err());

        // Relative paths should be rejected
        assert!(validate_file_path("./file.txt").is_err());
        assert!(validate_file_path("../file.txt").is_err());
        assert!(validate_file_path("file.txt").is_err());

        // UNC paths should be rejected
        assert!(validate_file_path(r"\\server\share\file.txt").is_err());
        assert!(validate_file_path("//server/share/file.txt").is_err());
    }

    #[test]
    fn test_is_windows_absolute_path() {
        // Valid Windows absolute paths
        assert!(is_windows_absolute_path(r"C:\Users\test"));
        assert!(is_windows_absolute_path(r"D:\Projects\file.md"));
        assert!(is_windows_absolute_path("C:/Users/test")); // Forward slashes also valid

        // Invalid cases
        assert!(!is_windows_absolute_path("/home/user")); // Unix path
        assert!(!is_windows_absolute_path("C:")); // Too short
        assert!(!is_windows_absolute_path("C:file")); // No slash after colon
        assert!(!is_windows_absolute_path("")); // Empty
        assert!(!is_windows_absolute_path("file.txt")); // Relative
    }

    #[test]
    fn test_is_unc_path() {
        // Valid UNC paths
        assert!(is_unc_path(r"\\server\share"));
        assert!(is_unc_path(r"\\server\share\file.txt"));
        assert!(is_unc_path("//server/share")); // Forward slash variant

        // Not UNC paths
        assert!(!is_unc_path(r"C:\Users\test"));
        assert!(!is_unc_path("/home/user"));
        assert!(!is_unc_path(r"\single\backslash"));
        assert!(!is_unc_path("/single/slash"));
    }

    #[test]
    fn test_validate_file_path_command_injection_cross_platform() {
        // These should be rejected on all platforms
        assert!(validate_file_path("path && rm -rf /").is_err());
        assert!(validate_file_path("path || cat secret").is_err());
        assert!(validate_file_path("path; echo pwned").is_err());
        assert!(validate_file_path("path | cat").is_err());
        assert!(validate_file_path("path`whoami`").is_err());
        assert!(validate_file_path("path$(id)").is_err());
    }

    #[test]
    fn test_validate_file_path_unc_rejection() {
        // UNC paths should be rejected on all platforms
        assert!(validate_file_path(r"\\server\share\file.txt").is_err());
        assert!(validate_file_path("//server/share/file.txt").is_err());
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_validate_file_path_windows_valid_paths() {
        // Valid Windows absolute paths should be accepted
        assert!(validate_file_path(r"C:\Users\test\file.md").is_ok());
        assert!(validate_file_path(r"D:\Projects\astro-site\content\post.md").is_ok());
        assert!(validate_file_path("C:/Users/test/file.md").is_ok()); // Forward slashes also valid
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_validate_file_path_unix_valid_paths() {
        // Valid Unix absolute paths should be accepted
        assert!(validate_file_path("/Users/test/file.md").is_ok());
        assert!(validate_file_path("/home/user/projects/post.md").is_ok());
        assert!(validate_file_path("~/Documents/file.md").is_ok());
    }
}
