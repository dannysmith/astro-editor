use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

/// A project's watcher and the generation that started it. Each start gets a new
/// generation, so an event loop can tell a watcher that was stopped or replaced
/// (its loop should end) from one that died (its loop should rebuild it).
pub struct WatcherEntry {
    generation: u64,
    watcher: RecommendedWatcher,
}

/// A newly built watcher, its event receiver, and whether it watches the
/// generated schemas folder (which doesn't exist until `astro sync` first runs)
struct ProjectWatcher {
    watcher: RecommendedWatcher,
    rx: Receiver<Event>,
    watches_schemas: bool,
}

fn schemas_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".astro")
        .join("collections")
}

// Global watcher storage, keyed by project path
type WatcherMap = Arc<Mutex<HashMap<String, WatcherEntry>>>;

static NEXT_GENERATION: AtomicU64 = AtomicU64::new(0);

/// Debounce window: process buffered events after 500ms of no new events
const DEBOUNCE_DURATION: Duration = Duration::from_millis(500);

/// Periodic rescan interval: emit rescan event every 5 minutes as a safety net
const RESCAN_INTERVAL: Duration = Duration::from_secs(300);

/// Create a file watcher for a project: its collection folders, its content
/// config and the generated JSON schemas.
fn create_project_watcher(
    project_path: &str,
    folders: &[String],
) -> Result<ProjectWatcher, String> {
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

    // Each collection folder, skipping any inside another. One that can't be
    // watched is logged and skipped, so the others still are
    let mut folders: Vec<PathBuf> = folders.iter().map(PathBuf::from).collect();
    folders.sort();
    folders.dedup();
    let mut watched: Vec<PathBuf> = Vec::new();
    for folder in folders {
        if folder.is_dir() && !watched.iter().any(|w| folder.starts_with(w)) {
            match watcher.watch(&folder, RecursiveMode::Recursive) {
                Ok(()) => watched.push(folder),
                Err(e) => log::warn!("Couldn't watch {}: {e}", folder.display()),
            }
        }
    }

    // The content config: `src/` and `src/content/`, where every candidate file
    // lives, so a config that's created or renamed later is seen too
    for config_dir in [
        project_root.join("src"),
        project_root.join("src").join("content"),
    ] {
        if config_dir.is_dir() && !watched.iter().any(|w| config_dir.starts_with(w)) {
            watcher
                .watch(&config_dir, RecursiveMode::NonRecursive)
                .map_err(|e| format!("Failed to watch {}: {e}", config_dir.display()))?;
        }
    }

    // Watch the generated JSON schemas directory: .astro/collections/. If it
    // doesn't exist yet, the event loop adds it once it appears
    let schemas_path = schemas_dir(project_path);
    let watches_schemas = schemas_path.exists();
    if watches_schemas {
        watcher
            .watch(&schemas_path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch schemas directory: {e}"))?;
    }

    Ok(ProjectWatcher {
        watcher,
        rx,
        watches_schemas,
    })
}

#[tauri::command]
#[specta::specta]
/// Watches a project. `folders` are its collection folders, which can be anywhere
/// in the project.
pub async fn start_watching_project(
    app: AppHandle,
    project_path: String,
    folders: Vec<String>,
) -> Result<(), String> {
    let ProjectWatcher {
        watcher,
        rx,
        watches_schemas,
    } = create_project_watcher(&project_path, &folders)?;
    let generation = NEXT_GENERATION.fetch_add(1, Ordering::Relaxed);

    // Store the watcher so it doesn't get dropped. This replaces (and drops) any
    // earlier watcher for the same path, whose event loop then ends.
    let watcher_map: State<WatcherMap> = app.state();
    watcher_map.lock().unwrap().insert(
        project_path.clone(),
        WatcherEntry {
            generation,
            watcher,
        },
    );

    // Clone the Arc for the spawned task
    let watcher_map_arc = app.state::<WatcherMap>().inner().clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        run_event_loop(
            app_handle,
            watcher_map_arc,
            rx,
            project_path,
            folders,
            generation,
            watches_schemas,
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
/// - If it was stopped or replaced by a newer start (which also disconnects the
///   channel), the loop ends
/// - Until `.astro/collections/` exists, each wake checks for it, then watches it
///   and reloads the schemas
async fn run_event_loop(
    app: AppHandle,
    watcher_map: WatcherMap,
    mut rx: Receiver<Event>,
    project_path: String,
    folders: Vec<String>,
    generation: u64,
    mut watches_schemas: bool,
) {
    let mut event_buffer: Vec<Event> = Vec::new();
    let mut last_rescan = Instant::now();

    loop {
        // A blocking wait, for as long as the project is open: `block_in_place`
        // tells the runtime, which moves other tasks off this worker thread
        match tokio::task::block_in_place(|| rx.recv_timeout(DEBOUNCE_DURATION)) {
            Ok(event) => {
                event_buffer.push(event);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Debounce timeout — process any buffered events
                if !event_buffer.is_empty() {
                    process_events(&app, &mut event_buffer).await;
                    event_buffer.clear();
                }

                if !watches_schemas {
                    watches_schemas =
                        watch_new_schemas_dir(&app, &watcher_map, &project_path, generation);
                }

                // Periodic rescan as safety net for missed changes
                if last_rescan.elapsed() >= RESCAN_INTERVAL {
                    log::debug!("Periodic rescan for {project_path}");
                    let _ = app.emit("watcher-rescan", &project_path);
                    last_rescan = Instant::now();
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                // Process remaining events, then rebuild if the watcher died
                if !event_buffer.is_empty() {
                    process_events(&app, &mut event_buffer).await;
                    event_buffer.clear();
                }

                // Stopping or replacing a watcher drops it, which also disconnects
                // the channel, so only rebuild if this loop still owns the entry
                let owns_entry = |watchers: &HashMap<String, WatcherEntry>| {
                    watchers
                        .get(&project_path)
                        .is_some_and(|entry| entry.generation == generation)
                };
                if !owns_entry(&watcher_map.lock().unwrap()) {
                    log::debug!("File watcher for {project_path} was stopped or replaced");
                    break;
                }

                log::warn!("File watcher disconnected for {project_path}, attempting rebuild");

                // Built without holding the lock, so a slow path can't block
                // starting or stopping other projects' watchers
                let rebuilt = match create_project_watcher(&project_path, &folders) {
                    Ok(built) => built,
                    Err(e) => {
                        log::error!("Failed to rebuild file watcher for {project_path}: {e}");
                        let _ = app.emit("watcher-error", &project_path);
                        break;
                    }
                };
                {
                    let mut watchers = watcher_map.lock().unwrap();
                    // A start or stop may have happened while the watcher was built
                    if !owns_entry(&watchers) {
                        log::debug!("File watcher for {project_path} was stopped or replaced");
                        break;
                    }
                    watchers.insert(
                        project_path.clone(),
                        WatcherEntry {
                            generation,
                            watcher: rebuilt.watcher,
                        },
                    );
                }
                rx = rebuilt.rx;
                watches_schemas = rebuilt.watches_schemas;
                last_rescan = Instant::now();
                log::info!("File watcher rebuilt for {project_path}");
                let _ = app.emit("watcher-rebuilt", &project_path);
            }
        }
    }
}

/// Watch `.astro/collections/` if it has appeared since the watcher started (a
/// project's first `astro sync`), and reload the schemas it now holds. Returns
/// whether it's watched.
fn watch_new_schemas_dir(
    app: &AppHandle,
    watcher_map: &WatcherMap,
    project_path: &str,
    generation: u64,
) -> bool {
    let schemas_path = schemas_dir(project_path);
    if !schemas_path.exists() {
        return false;
    }

    let mut watchers = watcher_map.lock().unwrap();
    // A stopped or replaced watcher is no longer this loop's to change
    let Some(entry) = watchers
        .get_mut(project_path)
        .filter(|entry| entry.generation == generation)
    else {
        return false;
    };
    if let Err(e) = entry
        .watcher
        .watch(&schemas_path, RecursiveMode::NonRecursive)
    {
        log::warn!("Failed to watch new schemas directory for {project_path}: {e}");
        return false;
    }

    log::info!("Watching new schemas directory for {project_path}");
    let _ = app.emit("schema-changed", ());
    true
}

/// Stops watching the project. A project with no watcher (it never started,
/// or a quick switch reached it first) is already stopped, so that's fine.
#[tauri::command]
#[specta::specta]
pub async fn stop_watching_project(app: AppHandle, project_path: String) -> Result<(), String> {
    let watcher_map: State<WatcherMap> = app.state();
    watcher_map.lock().unwrap().remove(&project_path);
    Ok(())
}

async fn process_events(app: &AppHandle, events: &mut [Event]) {
    let mut schema_changed = false;

    for event in events.iter() {
        match &event.kind {
            EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                for path in event.paths.iter().filter(|p| !is_dependency(p)) {
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

/// Files in `node_modules`, which a collection folder at the project root would
/// otherwise report
fn is_dependency(path: &std::path::Path) -> bool {
    path.components().any(|c| c.as_os_str() == "node_modules")
}

/// Check if a file path is a schema-related file
fn is_schema_file(path: &std::path::Path) -> bool {
    // Normalize path to forward slashes for consistent cross-platform matching
    let path_str = crate::utils::path::normalize_path_for_serialization(path);

    // Any of the files Astro reads the content config from
    if crate::content_config::is_config_path(&path_str) {
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
