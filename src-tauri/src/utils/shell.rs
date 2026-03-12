use log::debug;
use std::env;

/// Compute an augmented PATH with common executable locations for production builds.
/// Returns the augmented PATH string to be passed to Command::new().env("PATH", ...).
pub fn get_augmented_path() -> String {
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
            "/Applications/Zed.app/Contents/MacOS",
        ];

        for common_path in &common_paths {
            if !paths.contains(common_path) {
                paths.push(common_path);
            }
        }

        let augmented = paths.join(":");
        debug!("Augmented PATH for shell execution: {augmented}");
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
            r"C:\Program Files\nodejs".to_string(),
        ];

        // User-specific install locations (VS Code per-user install)
        if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            common_paths.push(format!(r"{local_app_data}\Programs\Microsoft VS Code\bin"));
            common_paths.push(format!(
                r"{local_app_data}\Programs\cursor\resources\app\bin"
            ));
            common_paths.push(format!(r"{local_app_data}\pnpm"));
            common_paths.push(format!(r"{local_app_data}\npm"));
        }

        for common_path in &common_paths {
            if !paths.contains(common_path) {
                paths.push(common_path.clone());
            }
        }

        let augmented = paths.join(";");
        debug!("Augmented PATH for shell execution: {augmented}");
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
        debug!("Augmented PATH for shell execution: {augmented}");
        augmented
    }
}
