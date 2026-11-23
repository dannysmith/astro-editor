//! Finding the user's `git` and running it.
//!
//! Every command runs with stdin closed, `GIT_TERMINAL_PROMPT=0` (a missing
//! credential fails rather than waiting for a terminal that isn't there) and a
//! timeout that kills git and anything it started, such as a hook waiting on a
//! passphrase. Success is the exit code: git prints warnings and hints to stderr
//! when it succeeds.

use std::path::{Path, PathBuf};
use std::process::Command;

use super::READ_TIMEOUT;
use crate::process::{self, Failure};
use std::sync::OnceLock;
use std::time::Duration;

/// Why there's no `git` to run
#[derive(Debug, Clone, PartialEq)]
pub enum FindError {
    NotInstalled,
    /// macOS's `/usr/bin/git` is a stand-in that opens Apple's installer
    /// dialog when the command line tools aren't installed
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    CommandLineToolsMissing,
    /// Older than `MINIMUM_VERSION`
    TooOld {
        version: String,
    },
}

/// The oldest git AE's commands work with: `rev-parse --path-format` came in
/// 2.31
pub const MINIMUM_VERSION: (u32, u32) = (2, 31);

/// The `git` program, and the environment every command runs with
#[derive(Debug, Clone)]
pub struct Git {
    program: PathBuf,
    /// The user's environment (see `shell_env`), set on top of the app's own
    env: Vec<(String, String)>,
}

/// What a finished git command printed
#[derive(Debug)]
pub struct GitOutput {
    /// The exit code, or `None` when a signal ended it
    pub code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: String,
}

impl GitOutput {
    pub fn success(&self) -> bool {
        self.code == Some(0)
    }

    pub fn stdout_text(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }

    /// git's own message for a failure, for showing as it is
    pub fn error_message(&self) -> String {
        let stderr = self.stderr.trim();
        if !stderr.is_empty() {
            return stderr.to_string();
        }
        match self.code {
            Some(code) => format!("git exited with code {code}"),
            None => "git was stopped".to_string(),
        }
    }
}

/// Commands that run the repository's hooks
fn runs_hooks(args: &[&str]) -> bool {
    matches!(
        args.first(),
        Some(&("commit" | "push" | "merge" | "rebase" | "pull"))
    )
}

impl Git {
    /// The first `git` on the user's `PATH`, the one their terminal runs, run
    /// with the environment their terminal has (see `shell_env`), so AE reads
    /// the same config, reaches the same SSH agent and runs the same hooks.
    /// Runs the user's shell the first time, so call it off the main thread.
    /// Once found it's kept; not finding it isn't, so installing git or the
    /// command line tools while AE runs is noticed.
    pub fn find() -> Result<Git, FindError> {
        static FOUND: OnceLock<Git> = OnceLock::new();
        if let Some(git) = FOUND.get() {
            return Ok(git.clone());
        }
        let mut git = Git::find_on(crate::shell_env::user_path())?;
        git.env = crate::shell_env::user_environment().to_vec();
        let git = git.new_enough()?;
        Ok(FOUND.get_or_init(|| git).clone())
    }

    /// This `git`, unless it reports a version older than `MINIMUM_VERSION`.
    /// One whose version can't be read is given the benefit of the doubt.
    fn new_enough(self) -> Result<Git, FindError> {
        match self.version(&std::env::temp_dir()) {
            Ok(version) if parse_version(&version).is_some_and(|v| v < MINIMUM_VERSION) => {
                Err(FindError::TooOld { version })
            }
            _ => Ok(self),
        }
    }

    /// `git --version` without the `git version ` in front, like `2.56.1` or
    /// `2.50.1 (Apple Git-155)`
    pub fn version(&self, dir: &Path) -> Result<String, String> {
        let text = self.read(dir, &["--version"], READ_TIMEOUT)?;
        let text = text.trim();
        Ok(text
            .strip_prefix("git version ")
            .unwrap_or(text)
            .to_string())
    }

    /// The first `git` in the folders of `path`, a `PATH` value
    pub fn find_on(path: &str) -> Result<Git, FindError> {
        let program = std::env::split_paths(path)
            // A relative folder would be looked in from AE's own folder, and
            // git run from the project's: never what's meant
            .filter(|dir| dir.is_absolute())
            .map(|dir| dir.join(if cfg!(windows) { "git.exe" } else { "git" }))
            .find(|candidate| is_executable(candidate))
            .ok_or(FindError::NotInstalled)?;
        #[cfg(target_os = "macos")]
        if program == Path::new("/usr/bin/git") && !command_line_tools_installed() {
            return Err(FindError::CommandLineToolsMissing);
        }
        Ok(Git {
            program,
            env: vec![("PATH".to_string(), path.to_string())],
        })
    }

    pub fn program(&self) -> &Path {
        &self.program
    }

    /// An environment variable as git sees it: from the user's shell, or else
    /// AE's own environment
    pub fn env_var(&self, name: &str) -> Option<String> {
        self.env
            .iter()
            .rev()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.clone())
            .or_else(|| std::env::var(name).ok())
    }

    /// Adds an environment variable to every command, for tests that keep git
    /// away from the developer's own config and repositories
    #[cfg(test)]
    pub fn with_env(mut self, key: &str, value: &str) -> Git {
        self.env.push((key.to_string(), value.to_string()));
        self
    }

    /// Runs `git <args>` in `dir` and returns what it printed, or git's own
    /// message if it fails. For commands whose output is all that matters.
    pub fn read(&self, dir: &Path, args: &[&str], timeout: Duration) -> Result<String, String> {
        let output = self.run(dir, args, timeout)?;
        if !output.success() {
            return Err(output.error_message());
        }
        Ok(output.stdout_text())
    }

    /// Runs `git <args>` in `dir`. `Err` when git can't be started or takes
    /// longer than `timeout`; a command that runs and fails is an `Ok` with a
    /// non-zero code.
    pub fn run(&self, dir: &Path, args: &[&str], timeout: Duration) -> Result<GitOutput, String> {
        let mut command = Command::new(&self.program);
        // First, so the settings below win over the user's
        command.envs(self.env.iter().map(|(k, v)| (k, v)));
        if runs_hooks(args) {
            // Hooks inherit git's environment, and should run as they do in a
            // terminal: a hook's `'*.md'` pathspec matching only a file named
            // `*.md` would quietly do nothing. These commands take no paths
            // from AE, so they need none of the settings below
            command.args(args);
        } else {
            command
                // Paths come back unquoted, as UTF-8
                .args(["-c", "core.quotepath=off"])
                .args(args)
                // A file named `a*.md` is that file, not a pattern.
                // `check-ignore` takes plain paths and refuses to run with it set.
                .env(
                    "GIT_LITERAL_PATHSPECS",
                    if args.first() == Some(&"check-ignore") {
                        "0"
                    } else {
                        "1"
                    },
                )
                // Status doesn't write the index, so it never competes with a
                // git running in a terminal for `index.lock`, or wakes the git
                // folder watcher
                .env("GIT_OPTIONAL_LOCKS", "0")
                // Messages in English, which AE looks for ("not a git
                // repository"), whatever language the Mac is set to
                .env("LC_ALL", "C");
            // From the user's shell, these change how AE's paths are read:
            // case-insensitive pathspecs can't be literal, and `check-ignore`
            // refuses them
            for name in [
                "GIT_ICASE_PATHSPECS",
                "GIT_GLOB_PATHSPECS",
                "GIT_NOGLOB_PATHSPECS",
            ] {
                command.env_remove(name);
            }
        }
        command.current_dir(dir).env("GIT_TERMINAL_PROMPT", "0");
        // Inherited, these would point every command at another repository,
        // or another repository's data
        for name in [
            "GIT_DIR",
            "GIT_WORK_TREE",
            "GIT_INDEX_FILE",
            "GIT_COMMON_DIR",
            "GIT_OBJECT_DIRECTORY",
            "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        ] {
            command.env_remove(name);
        }
        match process::run(&mut command, timeout) {
            Ok(finished) => Ok(GitOutput {
                code: finished.status.code(),
                stdout: finished.stdout,
                stderr: String::from_utf8_lossy(&finished.stderr).into_owned(),
            }),
            Err(Failure::Spawn(e)) => Err(format!("Couldn't run {}: {e}", self.program.display())),
            Err(Failure::Wait(e)) => Err(format!("Couldn't wait for git: {e}")),
            Err(Failure::TimedOut) => Err(format!(
                "git {} took longer than {} seconds and was stopped",
                args.first().unwrap_or(&""),
                timeout.as_secs()
            )),
        }
    }
}

/// The major and minor numbers of a version like `2.50.1 (Apple Git-155)` or
/// `2.39.3.windows.1`
fn parse_version(version: &str) -> Option<(u32, u32)> {
    let mut numbers = version.split(['.', ' ']).map(str::parse::<u32>);
    Some((numbers.next()?.ok()?, numbers.next()?.ok()?))
}

/// A file that can be run
pub fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata()
            .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    path.is_file()
}

#[cfg(target_os = "macos")]
fn command_line_tools_installed() -> bool {
    use std::process::Stdio;
    Command::new("/usr/bin/xcode-select")
        .arg("-p")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::time::Instant;
    use tempfile::TempDir;

    fn script(dir: &Path, name: &str, body: &str) -> PathBuf {
        let path = dir.join(name);
        fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        path
    }

    #[test]
    fn finds_the_first_executable_git_on_the_path() {
        let dir = TempDir::new().unwrap();
        let first = dir.path().join("first");
        let second = dir.path().join("second");
        fs::create_dir_all(&first).unwrap();
        fs::create_dir_all(&second).unwrap();
        // Not executable, so skipped
        fs::write(first.join("git"), "").unwrap();
        let git = script(&second, "git", "exit 0");
        let path = format!("{}:{}", first.display(), second.display());
        assert_eq!(Git::find_on(&path).unwrap().program(), git);
        assert_eq!(
            Git::find_on(&first.display().to_string()).unwrap_err(),
            FindError::NotInstalled
        );
    }

    #[test]
    fn skips_relative_folders_on_the_path() {
        let dir = TempDir::new().unwrap();
        let relative = dir.path().join("relative");
        let absolute = dir.path().join("absolute");
        fs::create_dir_all(&relative).unwrap();
        fs::create_dir_all(&absolute).unwrap();
        script(&relative, "git", "exit 0");
        let git = script(&absolute, "git", "exit 0");
        // The same folder, written relative to the tests' working folder
        let cwd = std::env::current_dir().unwrap();
        let written = pathdiff::diff_paths(&relative, &cwd).unwrap();
        assert!(written.is_relative());
        let path = format!("{}:{}", written.display(), absolute.display());
        assert_eq!(Git::find_on(&path).unwrap().program(), git);
    }

    #[test]
    fn runs_with_the_fixed_environment_and_no_stdin() {
        let dir = TempDir::new().unwrap();
        script(
            dir.path(),
            "git",
            "echo \"$@|$GIT_TERMINAL_PROMPT|$GIT_LITERAL_PATHSPECS|$GIT_OPTIONAL_LOCKS|$LC_ALL|${GIT_DIR:-none}|${GIT_COMMON_DIR:-none}|${GIT_ICASE_PATHSPECS:-none}|$SSH_AUTH_SOCK\"\n/bin/cat\necho err >&2\nexit 3",
        );
        // The user's environment, including settings AE overrides
        let git = Git::find_on(&dir.path().display().to_string())
            .unwrap()
            .with_env("SSH_AUTH_SOCK", "/agent.sock")
            .with_env("GIT_DIR", "/elsewhere/.git")
            .with_env("GIT_COMMON_DIR", "/elsewhere/.git")
            .with_env("GIT_ICASE_PATHSPECS", "1")
            .with_env("GIT_TERMINAL_PROMPT", "1")
            .with_env("LC_ALL", "de_DE.UTF-8");
        let output = git
            .run(dir.path(), &["status", "--short"], Duration::from_secs(5))
            .unwrap();
        assert_eq!(output.code, Some(3));
        assert!(!output.success());
        assert_eq!(
            output.stdout_text(),
            "-c core.quotepath=off status --short|0|1|0|C|none|none|none|/agent.sock\n"
        );
        assert_eq!(output.error_message(), "err");

        // A command that runs hooks leaves git's settings as the user has them
        let output = git
            .run(dir.path(), &["commit", "-q"], Duration::from_secs(5))
            .unwrap();
        assert_eq!(
            output.stdout_text(),
            "commit -q|0|||de_DE.UTF-8|none|none|1|/agent.sock\n"
        );
    }

    #[test]
    fn reads_the_version_and_refuses_a_git_too_old() {
        assert_eq!(parse_version("2.50.1 (Apple Git-155)"), Some((2, 50)));
        assert_eq!(parse_version("2.39.3.windows.1"), Some((2, 39)));
        assert_eq!(parse_version("2.31"), Some((2, 31)));
        assert_eq!(parse_version("unknown"), None);

        let dir = TempDir::new().unwrap();
        let path = dir.path().display().to_string();
        script(dir.path(), "git", "echo 'git version 2.30.9'");
        let error = Git::find_on(&path).unwrap().new_enough().unwrap_err();
        assert_eq!(
            error,
            FindError::TooOld {
                version: "2.30.9".into()
            }
        );
        script(dir.path(), "git", "echo 'git version 2.31.0'");
        assert!(Git::find_on(&path).unwrap().new_enough().is_ok());
        // Given the benefit of the doubt
        script(dir.path(), "git", "echo 'git version unknown'");
        assert!(Git::find_on(&path).unwrap().new_enough().is_ok());
    }

    #[test]
    fn a_slow_command_is_stopped_with_what_it_started() {
        let dir = TempDir::new().unwrap();
        let pid_file = dir.path().join("hook.pid");
        script(
            dir.path(),
            "git",
            &format!("/bin/sleep 30 &\necho $! > '{}'\nwait", pid_file.display()),
        );
        let git = Git::find_on(&dir.path().display().to_string()).unwrap();
        let started = Instant::now();
        let error = git
            .run(dir.path(), &["push"], Duration::from_secs(1))
            .unwrap_err();
        assert!(error.contains("git push took longer"), "{error}");
        assert!(started.elapsed() < Duration::from_secs(5));
        let pid: i32 = fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        assert!(crate::process::has_gone(pid), "sleep {pid} survived");
    }
}
