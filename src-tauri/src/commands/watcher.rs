use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

// Global watcher storage
type WatcherMap = Arc<Mutex<HashMap<String, RecommendedWatcher>>>;

#[tauri::command]
#[specta::specta]
pub async fn start_watching_project(app: AppHandle, project_path: String) -> Result<(), String> {
    start_watching_project_with_content_dir(app, project_path, None).await
}

#[tauri::command]
#[specta::specta]
pub async fn start_watching_project_with_content_dir(
    app: AppHandle,
    project_path: String,
    content_directory: Option<String>,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();

    let mut watcher = notify::recommended_watcher(move |result| match result {
        Ok(event) => {
            if let Err(e) = tx.send(event) {
                eprintln!("Failed to send file event: {e}");
            }
        }
        Err(e) => eprintln!("Watch error: {e:?}"),
    })
    .map_err(|e| format!("Failed to create watcher: {e}"))?;

    let project_root = PathBuf::from(&project_path);

    // Watch the content directory specifically (use override if provided)
    let content_path = if let Some(content_dir) = &content_directory {
        project_root.join(content_dir)
    } else {
        project_root.join("src").join("content")
    };

    if content_path.exists() {
        watcher
            .watch(&content_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch content directory: {e}"))?;
    }

    // Watch for schema changes: src/content/config.ts or src/content.config.ts
    let config_paths = vec![
        project_root.join("src").join("content").join("config.ts"),
        project_root.join("src").join("content.config.ts"),
    ];

    for config_path in config_paths {
        if config_path.exists() {
            watcher
                .watch(&config_path, RecursiveMode::NonRecursive)
                .map_err(|e| format!("Failed to watch config file: {e}"))?;
        }
    }

    // Watch the generated JSON schemas directory: .astro/collections/
    let schemas_path = project_root.join(".astro").join("collections");
    if schemas_path.exists() {
        watcher
            .watch(&schemas_path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch schemas directory: {e}"))?;
    }

    // Store the watcher so it doesn't get dropped
    let watcher_map: State<WatcherMap> = app.state();
    {
        let mut watchers = watcher_map.lock().unwrap();
        watchers.insert(project_path.clone(), watcher);
    }

    // Handle events in a separate thread
    let app_handle = app.clone();
    tokio::spawn(async move {
        let mut event_buffer = Vec::new();
        let mut last_event_time = std::time::Instant::now();

        while let Ok(event) = rx.recv() {
            event_buffer.push(event);

            // Debounce events - wait 500ms after last event before processing
            if last_event_time.elapsed() > Duration::from_millis(500) {
                process_events(&app_handle, &mut event_buffer).await;
                event_buffer.clear();
            }
            last_event_time = std::time::Instant::now();
        }
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_watching_project(app: AppHandle, project_path: String) -> Result<(), String> {
    let watcher_map: State<WatcherMap> = app.state();
    let mut watchers = watcher_map.lock().unwrap();

    if watchers.remove(&project_path).is_some() {
        Ok(())
    } else {
        Err("No watcher found for this project".to_string())
    }
}

async fn process_events(app: &AppHandle, events: &mut [Event]) {
    let mut schema_changed = false;

    for event in events.iter() {
        match &event.kind {
            EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                for path in &event.paths {
                    let path_str = path.to_string_lossy();

                    // Check if it's a schema-related file
                    if is_schema_file(path) {
                        schema_changed = true;
                        continue;
                    }

                    // Check if it's a markdown file
                    if let Some(extension) = path.extension() {
                        if matches!(extension.to_str(), Some("md") | Some("mdx")) {
                            // Emit event to frontend
                            if let Err(e) = app.emit(
                                "file-changed",
                                FileChangeEvent {
                                    path: path_str.to_string(),
                                    kind: format!("{:?}", event.kind),
                                },
                            ) {
                                eprintln!("Failed to emit file change event: {e}");
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Emit schema-changed event once if any schema files changed
    if schema_changed {
        if let Err(e) = app.emit("schema-changed", ()) {
            eprintln!("Failed to emit schema change event: {e}");
        }
    }
}

/// Check if a file path is a schema-related file
fn is_schema_file(path: &std::path::Path) -> bool {
    let path_str = path.to_string_lossy();

    // Check for content config files
    if path_str.ends_with("src/content/config.ts") || path_str.ends_with("src/content.config.ts") {
        return true;
    }

    // Check for generated JSON schema files
    if path_str.contains(".astro/collections/") && path_str.ends_with(".schema.json") {
        return true;
    }

    false
}

#[derive(serde::Serialize, Clone)]
struct FileChangeEvent {
    path: String,
    kind: String,
}

// Initialize the watcher map when the app starts
pub fn init_watcher_state() -> WatcherMap {
    Arc::new(Mutex::new(HashMap::new()))
}
