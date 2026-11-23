//! Git, for the experimental Git panel.
//!
//! Runs the user's own `git` as a child process, so credentials, SSH agents,
//! hooks, signing, LFS, worktrees and submodules behave as they do in a
//! terminal, and AE needs no auth code. Git's config is the only source of
//! truth: AE stores nothing about git except whether the panel is on.
//!
//! Only pulling changes files in the working tree, and only when it can do so
//! cleanly (`remote`). Commands that change the index take explicit paths,
//! never `add -A` or `commit -a`. See `docs/developer/git.md`.

pub mod commit;
pub mod remote;
pub mod repo;
pub mod runner;
pub mod setup;
pub mod state;
pub mod status;

#[cfg(test)]
mod test_repos;

use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

/// For commands that only read. Long enough for a large repository on a slow
/// disk, short enough that a hung command doesn't hold the panel for long.
pub const READ_TIMEOUT: Duration = Duration::from_secs(15);

/// For commands that may run hooks, sign or use the network: a `pre-commit`
/// running a linter, a signing key that asks to be unlocked, a slow remote
pub const WRITE_TIMEOUT: Duration = Duration::from_secs(120);

/// For pushing and fetching, which may send or receive a lot: a post's
/// full-size photos over slow wifi
pub const NETWORK_TIMEOUT: Duration = Duration::from_secs(600);

static WRITING: Mutex<()> = Mutex::new(());

/// Held while a command changes the repository (staging, committing, pushing,
/// pulling), so AE's writes run one at a time and never race each other for
/// git's `index.lock`
pub fn writing() -> MutexGuard<'static, ()> {
    WRITING.lock().unwrap_or_else(|e| e.into_inner())
}
