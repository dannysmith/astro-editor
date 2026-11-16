//! Commands for the experimental Git panel. The work is in `crate::git`.

use std::path::Path;

use super::run_blocking;
use crate::git::setup::{self, GitSetup};

/// What Project Settings shows about git for the project at `project_path`:
/// the `git` found, the repository, and the config that affects committing
#[tauri::command]
#[specta::specta]
pub async fn git_setup(project_path: String) -> Result<GitSetup, String> {
    run_blocking(move || Ok(setup::check(Path::new(&project_path)))).await
}
