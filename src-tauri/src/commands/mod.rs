pub mod clipboard;
pub mod diagnostics;
pub mod files;
pub mod fonts;
pub mod git;
pub mod ide;
pub mod mdx_components;
pub mod menu;
pub mod preferences;
pub mod project;
pub mod quit;
pub mod updater;
pub mod watcher;

/// Runs `work` on the async runtime's pool for blocking work, for commands that
/// walk a collection or read many files. Tauri runs every command's body on one
/// of the runtime's few worker threads, so a long walk there would hold up the
/// commands queued behind it, saves included.
pub(crate) async fn run_blocking<T, F>(work: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("Background task failed: {e}"))?
}
