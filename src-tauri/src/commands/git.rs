//! Commands for the experimental Git panel. The work is in `crate::git`.

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

use super::run_blocking;
use crate::git::commit;
use crate::git::remote;
use crate::git::repo::Repository;
use crate::git::runner::Git;
use crate::git::setup::{self, GitSetup};
use crate::git::state::{self, GitState};

/// What Project Settings shows about git for the project at `project_path`:
/// the `git` found, the repository, and the config that affects committing
#[tauri::command]
#[specta::specta]
pub async fn git_setup(project_path: String) -> Result<GitSetup, String> {
    run_blocking(move || Ok(setup::check(Path::new(&project_path)))).await
}

/// What the Git tab shows: the branch, the changes in the project folder, and
/// the state of the entry at `entry_path` (absolute) if one is open
#[tauri::command]
#[specta::specta]
pub async fn git_state(
    project_path: String,
    entry_path: Option<String>,
) -> Result<GitState, String> {
    run_blocking(move || {
        Ok(state::read(
            Path::new(&project_path),
            entry_path.as_deref().map(Path::new),
        ))
    })
    .await
}

/// Stages `paths` (relative to the repository root) for a commit
#[tauri::command]
#[specta::specta]
pub async fn git_stage(project_path: String, paths: Vec<String>) -> Result<(), String> {
    run_blocking(move || {
        let (git, repository) = open(&project_path)?;
        commit::stage(&git, &repository, &paths)
    })
    .await
}

/// Takes `paths` out of the index again, as cancelling a commit does
#[tauri::command]
#[specta::specta]
pub async fn git_unstage(project_path: String, paths: Vec<String>) -> Result<(), String> {
    run_blocking(move || {
        let (git, repository) = open(&project_path)?;
        commit::unstage(&git, &repository, &paths)
    })
    .await
}

/// Stages `paths` again, to take edits saved since, and commits everything
/// staged. Returns the commit's abbreviated hash.
#[tauri::command]
#[specta::specta]
pub async fn git_commit(
    project_path: String,
    paths: Vec<String>,
    message: String,
) -> Result<String, String> {
    run_blocking(move || {
        let (git, repository) = open(&project_path)?;
        commit::commit(&git, &repository, &paths, &message)
    })
    .await
}

/// Pushes the branch to its upstream
#[tauri::command]
#[specta::specta]
pub async fn git_push(project_path: String) -> Result<(), String> {
    run_blocking(move || {
        let (git, repository) = open(&project_path)?;
        remote::push(&git, &repository)
    })
    .await
}

/// Fetches and brings in the upstream's new commits, only when that can be
/// done cleanly. Returns how many commits came in.
#[tauri::command]
#[specta::specta]
pub async fn git_pull(project_path: String) -> Result<u32, String> {
    run_blocking(move || {
        let (git, repository) = open(&project_path)?;
        remote::pull(&git, &repository)
    })
    .await
}

/// Checks the branch's remote can be reached, for Project Settings. Returns
/// its URL.
#[tauri::command]
#[specta::specta]
pub async fn git_check_remote(project_path: String) -> Result<String, String> {
    run_blocking(move || {
        let (git, repository) = open(&project_path)?;
        remote::check(&git, &repository)
    })
    .await
}

/// Git and the project's repository, for the commands that write. The tab
/// only offers them once it's read the repository, so failing here is rare.
fn open(project_path: &str) -> Result<(Git, Repository), String> {
    let git = Git::find().map_err(|_| "Git isn't available.".to_string())?;
    let repository = setup::open(&git, Path::new(project_path))
        .map_err(|_| "The project isn't in a git repository AE can use.".to_string())?;
    Ok((git, repository))
}

/// The git folder watcher, while the Git tab is showing: the project it's for,
/// and the watcher (dropping it stops it, and its thread ends)
pub type GitWatcherState = Mutex<Option<(String, RecommendedWatcher)>>;

/// How long the git folder has to be quiet before `git-changed` is sent. A
/// commit or a pull writes many files in a burst.
const GIT_DEBOUNCE: Duration = Duration::from_millis(300);

/// Watches the project's git folder and sends `git-changed` (with the project
/// path) when something changes there: a commit, staging, a branch switch, a
/// push or fetch (remote refs move), or a merge or rebase starting or ending.
/// That's how the tab notices git used from another app. Replaces any earlier
/// watcher. A project that isn't in a repository is quietly not watched.
#[tauri::command]
#[specta::specta]
pub async fn git_watch_start(app: AppHandle, project_path: String) -> Result<(), String> {
    let project = project_path.clone();
    let folders = run_blocking(move || {
        let Ok(git) = Git::find() else {
            return Ok(None);
        };
        Ok(setup::open(&git, Path::new(&project))
            .ok()
            .map(|repository| folders_to_watch(&repository.git_dir, &repository.common_dir)))
    })
    .await?;
    let Some(folders) = folders else {
        return Ok(());
    };

    let (tx, rx) = mpsc::channel::<Event>();
    let mut watcher = notify::recommended_watcher(move |result: Result<Event, notify::Error>| {
        if let Ok(event) = result {
            let _ = tx.send(event);
        }
    })
    .map_err(|e| format!("Couldn't watch the git folder: {e}"))?;
    for folder in &folders {
        watcher
            .watch(folder, RecursiveMode::Recursive)
            .map_err(|e| format!("Couldn't watch {}: {e}", folder.display()))?;
    }
    let state: State<GitWatcherState> = app.state();
    *state.lock().unwrap() = Some((project_path.clone(), watcher));

    std::thread::spawn(move || loop {
        // Wait for something that matters, then for the burst to end
        match rx.recv() {
            Ok(event) if matters(&event, &folders) => {}
            Ok(_) => continue,
            // The watcher was stopped or replaced
            Err(_) => return,
        }
        loop {
            match rx.recv_timeout(GIT_DEBOUNCE) {
                Ok(_) => continue,
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => return,
            }
        }
        let _ = app.emit("git-changed", &project_path);
    });
    Ok(())
}

/// Stops the git folder watcher, if it's for this project
#[tauri::command]
#[specta::specta]
pub async fn git_watch_stop(app: AppHandle, project_path: String) -> Result<(), String> {
    let state: State<GitWatcherState> = app.state();
    let mut watcher = state.lock().unwrap();
    if watcher
        .as_ref()
        .is_some_and(|(path, _)| *path == project_path)
    {
        *watcher = None;
    }
    Ok(())
}

/// The working tree's git folder and the shared one, or just the shared one
/// when the first is inside it (a linked worktree's, or a submodule's)
fn folders_to_watch(git_dir: &Path, common_dir: &Path) -> Vec<PathBuf> {
    if git_dir.starts_with(common_dir) {
        vec![common_dir.to_path_buf()]
    } else {
        vec![git_dir.to_path_buf(), common_dir.to_path_buf()]
    }
}

/// Whether an event in the git folder can change what the tab shows. Objects
/// and reflogs are written with everything else, and lock files come before
/// the rename that finishes the change.
fn matters(event: &Event, folders: &[PathBuf]) -> bool {
    event.paths.iter().any(|path| {
        let Some(relative) = folders.iter().find_map(|f| path.strip_prefix(f).ok()) else {
            return false;
        };
        if path.extension().is_some_and(|e| e == "lock") {
            return false;
        }
        // `refs/heads/logs` is a branch, so only look before any `refs`
        !relative
            .components()
            .map(|c| c.as_os_str())
            .take_while(|c| *c != "refs")
            .any(|c| c == "objects" || c == "logs")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{EventKind, ModifyKind};

    fn event(path: &str) -> Event {
        Event::new(EventKind::Modify(ModifyKind::Any)).add_path(PathBuf::from(path))
    }

    #[test]
    fn only_changes_that_affect_the_tab_matter() {
        let folders = [PathBuf::from("/site/.git")];
        for path in [
            "/site/.git/index",
            "/site/.git/HEAD",
            "/site/.git/refs/heads/main",
            "/site/.git/refs/remotes/origin/main",
            "/site/.git/refs/heads/logs",
            "/site/.git/MERGE_HEAD",
            "/site/.git/worktrees/other/HEAD",
        ] {
            assert!(matters(&event(path), &folders), "{path}");
        }
        for path in [
            "/site/.git/index.lock",
            "/site/.git/objects/ab/cdef",
            "/site/.git/logs/HEAD",
            "/site/.git/worktrees/other/logs/HEAD",
            "/elsewhere/file",
        ] {
            assert!(!matters(&event(path), &folders), "{path}");
        }
    }

    #[test]
    fn watches_the_shared_folder_once_when_it_holds_the_other() {
        let common = Path::new("/main/.git");
        assert_eq!(
            folders_to_watch(Path::new("/main/.git/worktrees/x"), common),
            [common]
        );
        assert_eq!(folders_to_watch(common, common), [common]);
        assert_eq!(
            folders_to_watch(Path::new("/elsewhere/.git"), common),
            [PathBuf::from("/elsewhere/.git"), common.to_path_buf()]
        );
    }
}
