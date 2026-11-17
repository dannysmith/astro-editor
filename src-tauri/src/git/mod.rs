//! Git, for the experimental Git panel.
//!
//! Runs the user's own `git` as a child process, so credentials, SSH agents,
//! hooks, signing, LFS, worktrees and submodules behave as they do in a
//! terminal, and AE needs no auth code. Git's config is the only source of
//! truth: AE stores nothing about git except whether the panel is on.
//!
//! Nothing here changes files in the working tree. Commands that write take
//! explicit paths, never `add -A` or `commit -a`. See `docs/developer/git.md`.

pub mod commit;
pub mod repo;
pub mod runner;
pub mod setup;
pub mod state;
pub mod status;

#[cfg(test)]
mod test_repos;

use std::time::Duration;

/// For commands that only read. Long enough for a large repository on a slow
/// disk, short enough that a hung command doesn't hold the panel for long.
pub const READ_TIMEOUT: Duration = Duration::from_secs(15);
