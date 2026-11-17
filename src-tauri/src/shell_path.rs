//! The `PATH` that programs the user would run from a terminal need, such as
//! `git` and the hooks it runs (which call `node`, `bun`, `gpg`, `git-lfs`).
//!
//! An app opened from the Dock gets launchd's bare `PATH`, without Homebrew,
//! nvm, fnm, Volta or bun, and a login shell (`-l`) alone skips `~/.zshrc`,
//! where most of those put themselves. So the user's shell is asked once, as an
//! interactive login shell, and only its `PATH` is kept. If that fails, the
//! app's own `PATH` is used with Homebrew's folders added.
//!
//! `tauri dev` starts the app from a terminal, so in development the app's own
//! `PATH` is already complete and a broken lookup goes unnoticed. Check it in a
//! release build.

use std::sync::OnceLock;
#[cfg(unix)]
use std::{
    path::{Path, PathBuf},
    time::Duration,
};

/// How long the user's shell gets to print its `PATH`
#[cfg(unix)]
const RESOLVE_TIMEOUT: Duration = Duration::from_secs(8);

#[cfg(unix)]
const START_MARKER: &str = "__AE_PATH_START__";
#[cfg(unix)]
const END_MARKER: &str = "__AE_PATH_END__";

/// Set while the shell runs, so a `.zshrc` can skip slow or interactive setup
#[cfg(unix)]
const GUARD_VARIABLE: &str = "ASTRO_EDITOR_RESOLVING_ENVIRONMENT";

/// The user's `PATH`, resolved on first use and kept for the app's life. The
/// first call runs the user's shell (usually under a second, up to 8), so call
/// it off the main thread.
pub fn user_path() -> &'static str {
    static USER_PATH: OnceLock<String> = OnceLock::new();
    USER_PATH.get_or_init(|| {
        let current = std::env::var("PATH").unwrap_or_default();
        #[cfg(unix)]
        {
            let shell = std::env::var_os("SHELL")
                .filter(|s| !s.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("/bin/zsh"));
            let path = match resolve_shell_path(&shell, RESOLVE_TIMEOUT) {
                Some(path) => path,
                None => {
                    log::warn!(
                        "Astro Editor [PATH] Couldn't read PATH from {}, using the app's own",
                        shell.display()
                    );
                    join_path(
                        &current,
                        &[
                            PathBuf::from("/opt/homebrew/bin"),
                            PathBuf::from("/usr/local/bin"),
                        ],
                    )
                }
            };
            log::info!("Astro Editor [PATH] Using PATH={path}");
            path
        }
        #[cfg(not(unix))]
        current
    })
}

/// What the shell printed between the markers. Greetings, prompts and anything
/// else a `.zshrc` prints around it are ignored.
#[cfg(unix)]
fn parse_marked_path(output: &str) -> Option<String> {
    let start = output.rfind(START_MARKER)? + START_MARKER.len();
    let length = output[start..].find(END_MARKER)?;
    let path = output[start..start + length].trim();
    (!path.is_empty()).then(|| path.to_string())
}

/// Runs `<shell> -ilc` to print `PATH`. `None` if it fails, prints nothing
/// usable, or takes longer than `timeout` (it's then killed, with everything
/// it started).
#[cfg(unix)]
fn resolve_shell_path(shell: &Path, timeout: Duration) -> Option<String> {
    let mut command = std::process::Command::new(shell);
    command
        .arg("-ilc")
        // `printenv` rather than `$PATH`, which fish expands to a list and
        // doesn't accept as `${PATH}`. Every shell exports PATH colon-joined
        .arg(format!(
            "printf '%s' '{START_MARKER}'; /usr/bin/printenv PATH; printf '%s' '{END_MARKER}'"
        ))
        .env(GUARD_VARIABLE, "1");
    let finished = crate::process::run(&mut command, timeout).ok()?;
    parse_marked_path(&String::from_utf8_lossy(&finished.stdout))
}

/// `base`, then each of `extra` that isn't in it already
#[cfg(unix)]
fn join_path(base: &str, extra: &[PathBuf]) -> String {
    let mut parts: Vec<String> = base
        .split(':')
        .filter(|p| !p.is_empty())
        .map(String::from)
        .collect();
    for dir in extra {
        let dir = dir.to_string_lossy().to_string();
        if !parts.contains(&dir) {
            parts.push(dir);
        }
    }
    parts.join(":")
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Instant;
    use tempfile::TempDir;

    #[test]
    fn parses_path_between_markers() {
        let output = format!(
            "Last login: Tue\n\u{1b}[32m➜\u{1b}[0m welcome!\n{START_MARKER}/a/bin:/usr/bin{END_MARKER}\n% bye\n"
        );
        assert_eq!(
            parse_marked_path(&output).as_deref(),
            Some("/a/bin:/usr/bin")
        );
    }

    #[test]
    fn missing_or_empty_markers_are_none() {
        assert_eq!(parse_marked_path("PATH=/usr/bin"), None);
        assert_eq!(parse_marked_path(&format!("{START_MARKER}/usr/bin")), None);
        assert_eq!(
            parse_marked_path(&format!("{START_MARKER}{END_MARKER}")),
            None
        );
    }

    fn fake_shell(dir: &Path, body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let shell = dir.join("shell");
        fs::write(&shell, format!("#!/bin/sh\n{body}\n")).unwrap();
        fs::set_permissions(&shell, fs::Permissions::from_mode(0o755)).unwrap();
        shell
    }

    #[test]
    fn asks_the_shell_with_the_guard_set() {
        let dir = TempDir::new().unwrap();
        // Prints noise, then runs the command it's given, as zsh -ilc would
        let shell = fake_shell(
            dir.path(),
            &format!(
                "echo 'Welcome'\n[ \"${GUARD_VARIABLE}\" = 1 ] || exit 3\n[ \"$1\" = -ilc ] || exit 4\nPATH=/from/zshrc:/usr/bin:/bin\nexport PATH\neval \"$2\"\necho done"
            ),
        );
        assert_eq!(
            resolve_shell_path(&shell, Duration::from_secs(5)).as_deref(),
            Some("/from/zshrc:/usr/bin:/bin")
        );
    }

    #[test]
    fn slow_shell_times_out_and_its_children_go_too() {
        let dir = TempDir::new().unwrap();
        let pid_file = dir.path().join("sleep.pid");
        let shell = fake_shell(
            dir.path(),
            &format!("sleep 30 &\necho $! > '{}'\nwait", pid_file.display()),
        );
        let started = Instant::now();
        // Long enough for the fake shell to start under a busy parallel test run
        assert_eq!(resolve_shell_path(&shell, Duration::from_secs(2)), None);
        assert!(started.elapsed() < Duration::from_secs(6));
        let pid: i32 = fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        std::thread::sleep(Duration::from_millis(200));
        assert!(unsafe { libc::kill(pid, 0) } != 0, "sleep {pid} survived");
    }

    #[test]
    fn failing_shell_is_none() {
        let dir = TempDir::new().unwrap();
        let shell = fake_shell(dir.path(), "exit 1");
        assert_eq!(resolve_shell_path(&shell, Duration::from_secs(5)), None);
        assert_eq!(
            resolve_shell_path(&dir.path().join("no-such-shell"), Duration::from_secs(5)),
            None
        );
    }

    #[test]
    fn joins_without_duplicates() {
        let extra = [
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
        ];
        assert_eq!(
            join_path("/opt/homebrew/bin:/usr/bin", &extra),
            "/opt/homebrew/bin:/usr/bin:/usr/local/bin"
        );
        assert_eq!(join_path("", &extra[1..]), "/usr/local/bin");
    }
}
