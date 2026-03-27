use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

// Global watcher storage
type WatcherMap = Arc<Mutex<HashMap<String, RecommendedWatcher>>>;

/// Debounce window: process buffered events after 500ms of no new events
const DEBOUNCE_DURATION: Duration = Duration::from_millis(500);

/// Periodic rescan interval: emit rescan event every 5 minutes as a safety net
const RESCAN_INTERVAL: Duration = Duration::from_secs(300);

/// Create a configured file watcher for a project's content directories.
/// Returns the watcher and event receiver.
fn create_project_watcher(
    project_path: &str,
    content_directory: Option<&str>,
) -> Result<(RecommendedWatcher, Receiver<Event>), String> {
    let (tx, rx) = mpsc::channel();
    let project_path_log = project_path.to_string();

    let mut watcher =
        notify::recommended_watcher(move |result: Result<Event, notify::Error>| match result {
            Ok(event) => {
                if let Err(e) = tx.send(event) {
                    log::error!("Failed to send file event for {project_path_log}: {e}");
                }
            }
            Err(e) => {
                log::error!("Watch error for {project_path_log}: {e:?}");
            }
        })
        .map_err(|e| format!("Failed to create watcher: {e}"))?;

    let project_root = PathBuf::from(project_path);

    // Watch the content directory specifically (use override if provided)
    let content_path = if let Some(content_dir) = content_directory {
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
    for config_path in [
        project_root.join("src").join("content").join("config.ts"),
        project_root.join("src").join("content.config.ts"),
    ] {
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

    Ok((watcher, rx))
}

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
    let (watcher, rx) = create_project_watcher(&project_path, content_directory.as_deref())?;

    // Store the watcher so it doesn't get dropped
    let watcher_map: State<WatcherMap> = app.state();
    watcher_map
        .lock()
        .unwrap()
        .insert(project_path.clone(), watcher);

    // Clone the Arc for the spawned task
    let watcher_map_arc = app.state::<WatcherMap>().inner().clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        run_event_loop(
            app_handle,
            watcher_map_arc,
            rx,
            project_path,
            content_directory,
        )
        .await;
    });

    Ok(())
}

/// Event processing loop with automatic recovery and periodic rescan.
///
/// Uses `recv_timeout` with the debounce duration so that:
/// - Events are buffered and processed after 500ms of quiet
/// - Every 5 minutes, a rescan event is emitted as a safety net for missed changes
/// - If the watcher dies (channel disconnects), it's automatically rebuilt
async fn run_event_loop(
    app: AppHandle,
    watcher_map: WatcherMap,
    mut rx: Receiver<Event>,
    project_path: String,
    content_directory: Option<String>,
) {
    let mut event_buffer: Vec<Event> = Vec::new();
    let mut last_rescan = Instant::now();

    loop {
        match rx.recv_timeout(DEBOUNCE_DURATION) {
            Ok(event) => {
                event_buffer.push(event);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Debounce timeout — process any buffered events
                if !event_buffer.is_empty() {
                    process_events(&app, &mut event_buffer).await;
                    event_buffer.clear();
                }

                // Periodic rescan as safety net for missed changes
                if last_rescan.elapsed() >= RESCAN_INTERVAL {
                    log::debug!("Periodic rescan for {project_path}");
                    let _ = app.emit("watcher-rescan", &project_path);
                    last_rescan = Instant::now();
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                // Watcher died — process remaining events then rebuild
                if !event_buffer.is_empty() {
                    process_events(&app, &mut event_buffer).await;
                    event_buffer.clear();
                }

                log::warn!("File watcher disconnected for {project_path}, attempting rebuild");

                match create_project_watcher(&project_path, content_directory.as_deref()) {
                    Ok((new_watcher, new_rx)) => {
                        watcher_map
                            .lock()
                            .unwrap()
                            .insert(project_path.clone(), new_watcher);
                        rx = new_rx;
                        last_rescan = Instant::now();
                        log::info!("File watcher rebuilt for {project_path}");
                        let _ = app.emit("watcher-rebuilt", &project_path);
                    }
                    Err(e) => {
                        log::error!("Failed to rebuild file watcher for {project_path}: {e}");
                        let _ = app.emit("watcher-error", &project_path);
                        break;
                    }
                }
            }
        }
    }
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
                    // Check if it's a schema-related file
                    if is_schema_file(path) {
                        schema_changed = true;
                        continue;
                    }

                    // Check if it's a markdown file
                    if let Some(extension) = path.extension() {
                        if matches!(extension.to_str(), Some("md") | Some("mdx")) {
                            // Emit event to frontend with normalized path
                            let normalized_path =
                                crate::utils::path::normalize_path_for_serialization(path);
                            if let Err(e) = app.emit(
                                "file-changed",
                                FileChangeEvent {
                                    path: normalized_path,
                                    kind: format!("{:?}", event.kind),
                                },
                            ) {
                                eprintln!("Failed to emit file change event: {e}");
                            }
                        }
                    }
                }
            }
            // Other event kinds (e.g. Access, Any) are ignored
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
    // Normalize path to forward slashes for consistent cross-platform matching
    let path_str = crate::utils::path::normalize_path_for_serialization(path);

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
