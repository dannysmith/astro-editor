//! Throwaway repositories for tests, made with the real `git`.
//!
//! Each `TestRepos` is a temp folder that git can't look above
//! (`GIT_CEILING_DIRECTORIES`), with the developer's global and system config
//! ignored, so tests never read or write anything outside it.

use std::fs;
use std::path::{Path, PathBuf};

use super::runner::Git;
use super::READ_TIMEOUT;

pub struct TestRepos {
    // Deleted when dropped
    _dir: tempfile::TempDir,
    root: PathBuf,
    pub git: Git,
}

impl TestRepos {
    pub fn new() -> TestRepos {
        let dir = tempfile::TempDir::new().unwrap();
        // macOS's temp folder is behind a symlink, and git reports real paths
        let root = dunce::canonicalize(dir.path()).unwrap();
        let path = std::env::var("PATH").unwrap_or_default();
        let git = Git::find_on(&path)
            .expect("tests need git")
            .with_env("GIT_CEILING_DIRECTORIES", root.to_str().unwrap())
            .with_env("GIT_CONFIG_GLOBAL", "/dev/null")
            .with_env("GIT_CONFIG_NOSYSTEM", "1")
            // Git's last resort for an email, which tests set in config
            .with_env("EMAIL", "");
        TestRepos {
            _dir: dir,
            root,
            git,
        }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// A plain folder
    pub fn dir(&self, name: &str) -> PathBuf {
        let dir = self.root.join(name);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A new repository on `main` with an identity and signing off
    pub fn init(&self, name: &str) -> PathBuf {
        let dir = self.dir(name);
        self.git_ok(&dir, &["init", "-q", "-b", "main"]);
        self.git_ok(&dir, &["config", "user.name", "Test Writer"]);
        self.git_ok(&dir, &["config", "user.email", "writer@example.com"]);
        self.git_ok(&dir, &["config", "commit.gpgsign", "false"]);
        dir
    }

    /// Commits everything in the working tree (or an empty commit)
    pub fn commit_all(&self, dir: &Path, message: &str) {
        self.git_ok(dir, &["add", "-A"]);
        self.git_ok(dir, &["commit", "-q", "--allow-empty", "-m", message]);
    }

    /// Runs git and returns its output, failing the test if git fails
    pub fn git_ok(&self, dir: &Path, args: &[&str]) -> String {
        let output = self.git.run(dir, args, READ_TIMEOUT).unwrap();
        assert!(
            output.success(),
            "git {args:?} failed: {}",
            output.error_message()
        );
        output.stdout_text()
    }
}
