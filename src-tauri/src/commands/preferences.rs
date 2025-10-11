use tauri::{path::BaseDirectory, Manager};

/// Opens the preferences folder in the system's default file manager
#[tauri::command]
pub async fn open_preferences_folder(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    // Ensure the directory exists
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {e}"))?;
    }

    // Use the opener plugin to open the folder
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&app_data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open preferences folder: {e}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg(&app_data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open preferences folder: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&app_data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open preferences folder: {e}"))?;
    }

    Ok(())
}

/// Resets all preferences by deleting the app data directory and restarting the app
#[tauri::command]
#[allow(unreachable_code)]
pub async fn reset_all_preferences(
    app: tauri::AppHandle,
    window: tauri::Window,
) -> Result<(), String> {
    use log::info;

    let app_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    info!(
        "Astro Editor [PREFERENCES] Resetting all preferences - deleting: {}",
        app_data_dir.display()
    );

    // Delete the entire app data directory
    if app_data_dir.exists() {
        std::fs::remove_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to delete preferences: {e}"))?;

        info!("Astro Editor [PREFERENCES] All preferences deleted successfully");
    } else {
        info!("Astro Editor [PREFERENCES] No preferences directory found to delete");
    }

    // Restart the application
    info!("Astro Editor [PREFERENCES] Restarting application");

    // Close all windows first
    let _ = window.close();

    // Then restart the app - this will never return
    app.restart();

    // This line is unreachable but required for the function signature
    Ok(())
}
