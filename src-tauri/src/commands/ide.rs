use log::{debug, error, info, warn};
use std::env;
use std::process::Command;

/// The list of allowed IDE commands for security
const ALLOWED_IDES: &[&str] = &["cursor", "code", "vim", "nvim", "emacs", "subl"];

/// Fix PATH environment variable for production builds
/// This ensures shell commands can find executables in common locations
fn fix_path_env() {
    #[cfg(target_os = "macos")]
    {
        if let Ok(path) = env::var("PATH") {
            let mut paths: Vec<&str> = path.split(':').collect();

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

            let new_path = paths.join(":");
            env::set_var("PATH", &new_path);
            debug!("Fixed PATH for IDE execution: {new_path}");
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(path) = env::var("PATH") {
            let mut paths: Vec<&str> = path.split(';').collect();

            // Common paths for IDEs on Windows
            // Note: Actual paths will be refined during Windows testing (Part B)
            let common_paths = [
                r"C:\Program Files\Microsoft VS Code\bin",
                r"C:\Users\Default\AppData\Local\Programs\Microsoft VS Code\bin",
                r"C:\Program Files\Cursor\resources\app\bin",
            ];

            for common_path in &common_paths {
                if !paths.contains(common_path) {
                    paths.push(common_path);
                }
            }

            let new_path = paths.join(";");
            env::set_var("PATH", &new_path);
            debug!("Fixed PATH for IDE execution: {new_path}");
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(path) = env::var("PATH") {
            let mut paths: Vec<&str> = path.split(':').collect();

            // Common paths for IDEs on Linux
            // Note: Actual paths will be refined during Linux testing (Part C)
            let common_paths = [
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                "/snap/bin",                              // Snap packages
                "/var/lib/flatpak/exports/bin",           // Flatpak
                "/home/.local/share/flatpak/exports/bin", // User Flatpak
                "/opt/visual-studio-code/bin",            // Some distros
            ];

            for common_path in &common_paths {
                if !paths.contains(common_path) {
                    paths.push(common_path);
                }
            }

            let new_path = paths.join(":");
            env::set_var("PATH", &new_path);
            debug!("Fixed PATH for IDE execution: {new_path}");
        }
    }
}

/// Validates that an IDE command is in the allowed list
fn validate_ide_command(ide: &str) -> bool {
    ALLOWED_IDES.contains(&ide)
}

/// Safely escapes a file path for shell execution
/// This prevents command injection attacks through malicious file paths
#[allow(dead_code)]
fn escape_shell_arg(arg: &str) -> String {
    #[cfg(not(target_os = "windows"))]
    {
        // For macOS/Unix systems, we'll use single quotes and escape any single quotes in the path
        if arg.contains('\'') {
            // If the path contains single quotes, we need to escape them properly
            format!("'{}'", arg.replace('\'', "'\"'\"'"))
        } else {
            // Simple case - wrap in single quotes
            format!("'{arg}'")
        }
    }

    #[cfg(target_os = "windows")]
    {
        // For Windows, we use double quotes and escape internal double quotes
        // Note: This is for CMD.exe compatibility. PowerShell has different rules.
        if arg.contains('"') {
            // Escape double quotes by doubling them
            format!("\"{}\"", arg.replace('"', "\"\""))
        } else {
            // Simple case - wrap in double quotes
            format!("\"{arg}\"")
        }
    }
}

/// Checks if a path looks like a Windows absolute path (e.g., C:\, D:\)
#[allow(dead_code)]
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

    // Fix PATH environment for production builds
    fix_path_env();

    // Escape the file path for safe shell execution
    let escaped_path = escape_shell_arg(&file_path);

    info!("Executing IDE command: {ide_command} {escaped_path}");

    // Execute the command
    let result = Command::new(&ide_command)
        .arg(&file_path) // Use the original path, not escaped, since Command handles it safely
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

    // Fix PATH first
    fix_path_env();

    let mut available_ides = Vec::new();

    for ide in ALLOWED_IDES {
        // Try to execute the IDE with --version or --help to see if it's available
        let check_result = match *ide {
            "code" | "cursor" => Command::new(ide).arg("--version").output(),
            "vim" | "nvim" => Command::new(ide).arg("--version").output(),
            "emacs" => Command::new(ide).arg("--version").output(),
            "subl" => Command::new(ide).arg("--version").output(),
            _ => continue,
        };

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
    #[cfg(not(target_os = "windows"))]
    fn test_escape_shell_arg() {
        assert_eq!(escape_shell_arg("/simple/path"), "'/simple/path'");
        assert_eq!(
            escape_shell_arg("/path with spaces/file.txt"),
            "'/path with spaces/file.txt'"
        );
        assert_eq!(
            escape_shell_arg("/path/with'quote"),
            "'/path/with'\"'\"'quote'"
        );
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
}
