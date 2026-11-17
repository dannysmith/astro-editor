//! Finding the user's `git` and running it.
//!
//! Every command runs with stdin closed, `GIT_TERMINAL_PROMPT=0` (a missing
//! credential fails rather than waiting for a terminal that isn't there) and a
//! timeout that kills git and anything it started, such as a hook waiting on a
//! passphrase. Success is the exit code: git prints warnings and hints to stderr
//! when it succeeds.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Why there's no `git` to run
#[derive(Debug, Clone, PartialEq)]
pub enum FindError {
    NotInstalled,
    /// macOS's `/usr/bin/git` is a stand-in that opens Apple's installer
    /// dialog when the command line tools aren't installed
    CommandLineToolsMissing,
}

/// The `git` program, and the environment every command runs with
#[derive(Debug, Clone)]
pub struct Git {
    program: PathBuf,
    path: String,
    extra_env: Vec<(String, String)>,
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
    /// The first `git` on the user's `PATH` (see `shell_path`), the one their
    /// terminal runs, so AE reads the same config and runs the same hooks.
    /// Runs the user's shell the first time, so call it off the main thread.
    pub fn find() -> Result<Git, FindError> {
        Git::find_on(crate::shell_path::user_path())
    }

    /// The first `git` in the folders of `path`, a `PATH` value
    pub fn find_on(path: &str) -> Result<Git, FindError> {
        let program = std::env::split_paths(path)
            .map(|dir| dir.join(if cfg!(windows) { "git.exe" } else { "git" }))
            .find(|candidate| is_executable(candidate))
            .ok_or(FindError::NotInstalled)?;
        #[cfg(target_os = "macos")]
        if program == Path::new("/usr/bin/git") && !command_line_tools_installed() {
            return Err(FindError::CommandLineToolsMissing);
        }
        Ok(Git {
            program,
            path: path.to_string(),
            extra_env: Vec::new(),
        })
    }

    pub fn program(&self) -> &Path {
        &self.program
    }

    /// Adds an environment variable to every command, for tests that keep git
    /// away from the developer's own config and repositories
    #[cfg(test)]
    pub fn with_env(mut self, key: &str, value: &str) -> Git {
        self.extra_env.push((key.to_string(), value.to_string()));
        self
    }

    /// Runs `git <args>` in `dir`. `Err` when git can't be started or takes
    /// longer than `timeout`; a command that runs and fails is an `Ok` with a
    /// non-zero code.
    pub fn run(&self, dir: &Path, args: &[&str], timeout: Duration) -> Result<GitOutput, String> {
        let mut command = Command::new(&self.program);
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
                .env("GIT_OPTIONAL_LOCKS", "0");
        }
        command
            .current_dir(dir)
            .env("PATH", &self.path)
            .env("GIT_TERMINAL_PROMPT", "0")
            // Inherited, these would point every command at another repository
            .env_remove("GIT_DIR")
            .env_remove("GIT_WORK_TREE")
            .env_remove("GIT_INDEX_FILE")
            .envs(self.extra_env.iter().map(|(k, v)| (k, v)))
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // So a timeout also ends the hooks git started, and a hook that wants a
        // terminal fails rather than hanging
        #[cfg(unix)]
        crate::shell_path::in_new_session(&mut command);

        let mut child = command
            .spawn()
            .map_err(|e| format!("Couldn't run {}: {e}", self.program.display()))?;
        let stdout = read_in_background(child.stdout.take());
        let stderr = read_in_background(child.stderr.take());

        let deadline = Instant::now() + timeout;
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(10))
                }
                Ok(None) => {
                    kill(&mut child);
                    return Err(format!(
                        "git {} took longer than {} seconds and was stopped",
                        args.first().unwrap_or(&""),
                        timeout.as_secs()
                    ));
                }
                Err(e) => {
                    kill(&mut child);
                    return Err(format!("Couldn't wait for git: {e}"));
                }
            }
        };
        // Something a hook left running in the background may hold a pipe open
        let collect = |rx: std::sync::mpsc::Receiver<Vec<u8>>| {
            rx.recv_timeout(Duration::from_millis(500))
                .unwrap_or_default()
        };
        Ok(GitOutput {
            code: status.code(),
            stdout: collect(stdout),
            stderr: String::from_utf8_lossy(&collect(stderr)).into_owned(),
        })
    }
}

/// Reads a pipe to the end on its own thread, so a command that prints a lot
/// can't fill one pipe and stall while we wait on the other
fn read_in_background<R: Read + Send + 'static>(
    pipe: Option<R>,
) -> std::sync::mpsc::Receiver<Vec<u8>> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut output = Vec::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_end(&mut output);
        }
        let _ = tx.send(output);
    });
    rx
}

fn kill(child: &mut std::process::Child) {
    #[cfg(unix)]
    // SAFETY: signals only the process group created for this command
    unsafe {
        libc::kill(-(child.id() as libc::pid_t), libc::SIGKILL);
    }
    #[cfg(not(unix))]
    let _ = child.kill();
    let _ = child.wait();
}

fn is_executable(path: &Path) -> bool {
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
    fn runs_with_the_fixed_environment_and_no_stdin() {
        let dir = TempDir::new().unwrap();
        script(
            dir.path(),
            "git",
            "echo \"$@|$GIT_TERMINAL_PROMPT|$GIT_LITERAL_PATHSPECS|$GIT_OPTIONAL_LOCKS|${GIT_DIR:-none}\"\n/bin/cat\necho err >&2\nexit 3",
        );
        let git = Git::find_on(&dir.path().display().to_string()).unwrap();
        let output = git
            .run(dir.path(), &["status", "--short"], Duration::from_secs(5))
            .unwrap();
        assert_eq!(output.code, Some(3));
        assert!(!output.success());
        assert_eq!(
            output.stdout_text(),
            "-c core.quotepath=off status --short|0|1|0|none\n"
        );
        assert_eq!(output.error_message(), "err");

        // A command that runs hooks leaves git's settings as the user has them
        let output = git
            .run(dir.path(), &["commit", "-q"], Duration::from_secs(5))
            .unwrap();
        assert_eq!(output.stdout_text(), "commit -q|0|||none\n");
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
        std::thread::sleep(Duration::from_millis(200));
        assert!(unsafe { libc::kill(pid, 0) } != 0, "sleep {pid} survived");
    }
}
