use log::{error, info};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

pub struct PreviewState {
    pub child: Arc<Mutex<Option<Child>>>,
}

impl PreviewState {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn start_preview(
    app: AppHandle,
    state: State<'_, PreviewState>,
    project_path: String,
) -> Result<(), String> {
    info!("Starting preview for project at: {project_path}");

    // Kill existing preview if running
    stop_preview(state.clone()).await?;

    let augmented_path = crate::utils::shell::get_augmented_path();

    #[cfg(target_os = "windows")]
    let cmd_name = "pnpm.cmd";
    #[cfg(not(target_os = "windows"))]
    let cmd_name = "pnpm";

    let mut child = Command::new(cmd_name)
        .arg("dev")
        .current_dir(&project_path)
        .env("PATH", &augmented_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start pnpm dev: {e}"))?;

    let stdout = child.stdout.take().expect("Failed to open stdout");
    let stderr = child.stderr.take().expect("Failed to open stderr");

    // Store the child process
    let mut child_guard = state.child.lock().await;
    *child_guard = Some(child);

    // Monitor stdout
    let app_clone = app.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            info!("[PREVIEW STDOUT] {}", line);

            // Check for Astro's local URL (matches "http://localhost:4321/")
            if line.contains("http://localhost:") {
                // Try to extract the URL using a simple search
                if let Some(start) = line.find("http://localhost:") {
                    let part = &line[start..];
                    let end = part
                        .find(|c: char| c.is_whitespace() || c == '\u{1b}')
                        .unwrap_or(part.len());
                    let url = &part[..end];

                    // Clean up ANSI escape codes if any
                    let clean_url = url
                        .replace("\u{1b}[1m", "")
                        .replace("\u{1b}[22m", "")
                        .replace("\u{1b}[39m", "");

                    let _ = app_clone.emit("preview-url", clean_url.trim());
                }
            }
            let _ = app_clone.emit("preview-stdout", line);
        }
    });

    // Monitor stderr
    let app_clone = app.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            error!("[PREVIEW STDERR] {}", line);
            let _ = app_clone.emit("preview-stderr", line);
        }
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_preview(state: State<'_, PreviewState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().await;
    if let Some(mut child) = child_guard.take() {
        info!("Stopping preview process");
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn is_preview_running(state: State<'_, PreviewState>) -> Result<bool, String> {
    let mut child_guard = state.child.lock().await;
    if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process has exited; clear stored child so state reflects reality.
                *child_guard = None;
                Ok(false)
            }
            Ok(None) => {
                // Process is still running.
                Ok(true)
            }
            Err(e) => {
                // If we cannot determine status, log and assume it's still running.
                error!("Failed to check preview process status: {}", e);
                Ok(true)
            }
        }
    } else {
        Ok(false)
    }
}
