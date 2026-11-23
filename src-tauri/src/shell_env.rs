//! The environment programs the user runs from a terminal see, for `git` and
//! the hooks it runs: `PATH` (for `node`, `bun`, `gpg`, `git-lfs`), and
//! whatever else the user's shell sets up, such as `SSH_AUTH_SOCK` for an SSH
//! agent like 1Password's, `GIT_SSH_COMMAND`, `GNUPGHOME` or a proxy.
//!
//! An app opened from the Dock gets launchd's bare environment, without
//! Homebrew, nvm, fnm, Volta or bun on `PATH`, and a login shell (`-l`) alone
//! skips `~/.zshrc`, where most of those put themselves. So the user's shell is
//! asked once, as an interactive login shell, for its whole environment, as VS
//! Code does. If that fails, only `PATH` is set: the app's own, with Homebrew's
//! folders added.
//!
//! It's applied to the commands AE runs, never to AE's own process. It may hold
//! tokens, so it's never logged, apart from `PATH`.
//!
//! `tauri dev` starts the app from a terminal, so in development the app's own
//! environment is already complete and a broken lookup goes unnoticed. Check it
//! in a release build.

use std::sync::OnceLock;
#[cfg(unix)]
use std::{
    path::{Path, PathBuf},
    time::Duration,
};

/// How long the user's shell gets to print its environment
#[cfg(unix)]
const RESOLVE_TIMEOUT: Duration = Duration::from_secs(8);

#[cfg(unix)]
const START_MARKER: &str = "__AE_ENV_START__";
#[cfg(unix)]
const END_MARKER: &str = "__AE_ENV_END__";

/// Set while the shell runs, so a `.zshrc` can skip slow or interactive setup
#[cfg(unix)]
const GUARD_VARIABLE: &str = "ASTRO_EDITOR_RESOLVING_ENVIRONMENT";

/// Variables that describe the shell that printed the environment rather than
/// the user's setup
#[cfg(unix)]
const SHELL_SESSION_VARIABLES: &[&str] = &["PWD", "OLDPWD", "SHLVL", "_", GUARD_VARIABLE];

/// The user's environment, resolved on first use and kept for the app's life,
/// to set on top of the app's own for each command. Always has `PATH`. The
/// first call runs the user's shell (usually under a second, up to 8), so call
/// it off the main thread.
pub fn user_environment() -> &'static [(String, String)] {
    static USER_ENVIRONMENT: OnceLock<Vec<(String, String)>> = OnceLock::new();
    USER_ENVIRONMENT.get_or_init(|| {
        let current = std::env::var("PATH").unwrap_or_default();
        #[cfg(unix)]
        {
            let shell = std::env::var_os("SHELL")
                .filter(|s| !s.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("/bin/zsh"));
            let environment = resolve_shell_environment(&shell, RESOLVE_TIMEOUT)
                .filter(|vars| vars.iter().any(|(key, _)| key == "PATH"))
                .unwrap_or_else(|| {
                    log::warn!(
                        "Astro Editor [PATH] Couldn't read the environment from {}, using the app's own PATH",
                        shell.display()
                    );
                    let path = join_path(
                        &current,
                        &[
                            PathBuf::from("/opt/homebrew/bin"),
                            PathBuf::from("/usr/local/bin"),
                        ],
                    );
                    vec![("PATH".to_string(), path)]
                });
            log::info!("Astro Editor [PATH] Using PATH={}", path_in(&environment));
            environment
        }
        #[cfg(not(unix))]
        vec![("PATH".to_string(), current)]
    })
}

/// The user's `PATH`, from `user_environment`
pub fn user_path() -> &'static str {
    path_in(user_environment())
}

fn path_in(environment: &[(String, String)]) -> &str {
    environment
        .iter()
        .find(|(key, _)| key == "PATH")
        .map_or("", |(_, value)| value)
}

/// The variables the shell printed between the markers, as `env -0` prints
/// them (each `KEY=value` ends with a NUL, so values can hold newlines). The
/// markers end with a NUL too, so they're whole records, and a value that
/// happens to contain one can't cut the list short. Greetings, prompts and
/// anything else a `.zshrc` prints around them are ignored.
#[cfg(unix)]
fn parse_marked_environment(output: &str) -> Option<Vec<(String, String)>> {
    let records: Vec<&str> = output.split('\0').collect();
    // Anything a `.zshrc` printed first runs into the start marker
    let start = records.iter().rposition(|r| r.ends_with(START_MARKER))? + 1;
    let length = records[start..].iter().position(|r| *r == END_MARKER)?;
    let vars: Vec<(String, String)> = records[start..start + length]
        .iter()
        .filter_map(|entry| entry.split_once('='))
        .filter(|(key, _)| !key.is_empty() && !SHELL_SESSION_VARIABLES.contains(key))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect();
    (!vars.is_empty()).then_some(vars)
}

/// Runs `<shell> -ilc` to print its environment. `None` if it fails, prints
/// nothing usable, or takes longer than `timeout` (it's then killed, with
/// everything it started).
#[cfg(unix)]
fn resolve_shell_environment(shell: &Path, timeout: Duration) -> Option<Vec<(String, String)>> {
    let mut command = std::process::Command::new(shell);
    command
        .arg("-ilc")
        // Plain commands, which fish runs as well as POSIX shells
        .arg(format!(
            "/usr/bin/printf '%s\\0' '{START_MARKER}'; /usr/bin/env -0; /usr/bin/printf '%s\\0' '{END_MARKER}'"
        ))
        .env(GUARD_VARIABLE, "1");
    let finished = crate::process::run(&mut command, timeout).ok()?;
    parse_marked_environment(&String::from_utf8_lossy(&finished.stdout))
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

    fn vars(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn parses_the_environment_between_markers() {
        let output = format!(
            "Last login: Tue\n\u{1b}[32m➜\u{1b}[0m welcome!\n{START_MARKER}\0PATH=/a/bin:/usr/bin\0NOTE=two\nlines, then {END_MARKER}\0EQUALS=a=b\0SSH_AUTH_SOCK=/agent.sock\0{END_MARKER}\0\n% bye\n"
        );
        assert_eq!(
            parse_marked_environment(&output),
            Some(vars(&[
                ("PATH", "/a/bin:/usr/bin"),
                // A marker inside a value doesn't end the list
                ("NOTE", &format!("two\nlines, then {END_MARKER}")),
                ("EQUALS", "a=b"),
                ("SSH_AUTH_SOCK", "/agent.sock"),
            ]))
        );
    }

    #[test]
    fn leaves_out_the_shells_own_variables() {
        let output = format!(
            "{START_MARKER}\0PWD=/x\0OLDPWD=/y\0SHLVL=2\0_=/usr/bin/env\0{GUARD_VARIABLE}=1\0HOME=/h\0{END_MARKER}\0"
        );
        assert_eq!(
            parse_marked_environment(&output),
            Some(vars(&[("HOME", "/h")]))
        );
    }

    #[test]
    fn missing_or_empty_markers_are_none() {
        assert_eq!(parse_marked_environment("PATH=/usr/bin"), None);
        assert_eq!(
            parse_marked_environment(&format!("{START_MARKER}\0PATH=/usr/bin\0")),
            None
        );
        assert_eq!(
            parse_marked_environment(&format!("{START_MARKER}\0{END_MARKER}\0")),
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
                "echo 'Welcome'\n[ \"${GUARD_VARIABLE}\" = 1 ] || exit 3\n[ \"$1\" = -ilc ] || exit 4\nPATH=/from/zshrc:/usr/bin:/bin\nSSH_AUTH_SOCK=/from/zshrc.sock\nexport PATH SSH_AUTH_SOCK\neval \"$2\"\necho done"
            ),
        );
        let environment = resolve_shell_environment(&shell, Duration::from_secs(5)).unwrap();
        assert_eq!(path_in(&environment), "/from/zshrc:/usr/bin:/bin");
        assert!(environment.contains(&("SSH_AUTH_SOCK".into(), "/from/zshrc.sock".into())));
        assert!(!environment.iter().any(|(key, _)| key == GUARD_VARIABLE));
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
        assert_eq!(
            resolve_shell_environment(&shell, Duration::from_secs(2)),
            None
        );
        assert!(started.elapsed() < Duration::from_secs(6));
        let pid: i32 = fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        assert!(crate::process::has_gone(pid), "sleep {pid} survived");
    }

    #[test]
    fn failing_shell_is_none() {
        let dir = TempDir::new().unwrap();
        let shell = fake_shell(dir.path(), "exit 1");
        assert_eq!(
            resolve_shell_environment(&shell, Duration::from_secs(5)),
            None
        );
        assert_eq!(
            resolve_shell_environment(&dir.path().join("no-such-shell"), Duration::from_secs(5)),
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
