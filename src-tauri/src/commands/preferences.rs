use super::project::send_toast_notification;
use crate::models::preferences::{
    GlobalSettings, ListedProject, ProjectMetadata, ProjectRegistry, ProjectSettingsData,
    Relocation,
};
use crate::preferences::Preferences;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use tauri::{path::BaseDirectory, Manager};

/// Opens the preferences folder in the system's default file manager
#[tauri::command]
#[specta::specta]
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
#[specta::specta]
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

/// Global settings and the project registry
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredPreferences {
    pub global_settings: GlobalSettings,
    pub registry: ProjectRegistry,
    /// Files that couldn't be read, so were set aside and replaced with
    /// defaults, for the frontend to say so. Returned rather than sent as a
    /// toast, since this runs before the toast listener may be ready.
    pub problems: Vec<String>,
}

/// Reads global settings and the project registry. A file that couldn't be read
/// is set aside and replaced with defaults, and reported in `problems`.
#[tauri::command]
#[specta::specta]
pub async fn load_preferences(app: tauri::AppHandle) -> Result<StoredPreferences, String> {
    let preferences = Preferences::from_app(&app)?;
    let global = preferences.load_global_settings();
    let registry = preferences.load_registry();
    Ok(StoredPreferences {
        global_settings: global.value,
        registry: registry.value,
        problems: [global.problem, registry.problem]
            .into_iter()
            .flatten()
            .collect(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn save_global_settings(
    app: tauri::AppHandle,
    settings: GlobalSettings,
) -> Result<(), String> {
    Preferences::from_app(&app)?.save_global_settings(&settings)
}

/// A project as opened: its registry entry and its stored settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OpenedProject {
    pub project: ProjectMetadata,
    pub settings: ProjectSettingsData,
    /// It had no current settings file: it's new, or its settings are from
    /// before version 3 and were moved aside
    pub new_settings: bool,
}

/// Registers the project at `project_path` if it's new, marks it as last opened,
/// and returns it with its stored settings
#[tauri::command]
#[specta::specta]
pub async fn open_project(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<OpenedProject, String> {
    let opened = Preferences::from_app(&app)?.open_project(Path::new(&project_path))?;
    for problem in &opened.problems {
        show_problem(&app, problem);
    }
    Ok(OpenedProject {
        project: opened.metadata,
        settings: opened.settings,
        new_settings: opened.new_settings,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn save_project_settings(
    app: tauri::AppHandle,
    project_id: String,
    settings: ProjectSettingsData,
) -> Result<(), String> {
    Preferences::from_app(&app)?.save_project_settings(&project_id, &settings)
}

/// Every registered project, most recently opened first, with whether its
/// folder is still there
#[tauri::command]
#[specta::specta]
pub async fn list_projects(app: tauri::AppHandle) -> Result<Vec<ListedProject>, String> {
    let listed = Preferences::from_app(&app)?.list_projects();
    if let Some(problem) = &listed.problem {
        show_problem(&app, problem);
    }
    Ok(listed.value)
}

/// Forgets a project and deletes its settings, leaving the project untouched
#[tauri::command]
#[specta::specta]
pub async fn remove_project(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    Preferences::from_app(&app)?.remove_project(&project_id)
}

/// Points a project at the folder it moved to, keeping its settings. Reports
/// `alreadyRegistered` instead if another project is there, unless `replace`.
#[tauri::command]
#[specta::specta]
pub async fn relocate_project(
    app: tauri::AppHandle,
    project_id: String,
    project_path: String,
    replace: bool,
) -> Result<Relocation, String> {
    Preferences::from_app(&app)?.relocate_project(&project_id, Path::new(&project_path), replace)
}

/// Remembers the entry open in a project (an absolute path), so opening the
/// project reopens it, or forgets it with `None`
#[tauri::command]
#[specta::specta]
pub async fn set_last_entry(
    app: tauri::AppHandle,
    project_id: String,
    file_path: Option<String>,
) -> Result<(), String> {
    Preferences::from_app(&app)?.set_last_entry(&project_id, file_path.as_deref().map(Path::new))
}

fn show_problem(app: &tauri::AppHandle, problem: &str) {
    let _ = send_toast_notification(app, "warning", "Settings were reset", Some(problem));
}
