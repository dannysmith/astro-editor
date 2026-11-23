//! Running a child process with a timeout: the git runner (`git::runner`) and
//! the login-shell environment lookup (`shell_env`).

use std::io::{self, Read};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

/// How long output held open by something a finished process left running
/// in the background gets, before what's been read so far is used
const DRAIN_TIMEOUT: Duration = Duration::from_millis(500);

/// What a finished process printed
pub struct Finished {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub enum Failure {
    /// It couldn't be started
    Spawn(io::Error),
    /// Waiting for it failed; it was killed
    Wait(io::Error),
    /// It took longer than the timeout and was killed, with everything it
    /// started
    TimedOut,
}

/// Runs `command` with stdin closed, in a session of its own (see
/// `in_new_session`), reading its output on other threads so a process that
/// prints a lot can't stall on a full pipe. After it exits, output held open
/// by something it left running in the background (a hook starting a daemon)
/// gets half a second, then what's been read is used.
pub fn run(command: &mut Command, timeout: Duration) -> Result<Finished, Failure> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    in_new_session(command);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: git is a console program, and would otherwise
        // flash a console window each time it runs
        command.creation_flags(0x0800_0000);
    }
    let mut child = command.spawn().map_err(Failure::Spawn)?;
    let stdout = read_in_background(child.stdout.take());
    let stderr = read_in_background(child.stderr.take());

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            Ok(None) => {
                kill(&mut child);
                return Err(Failure::TimedOut);
            }
            Err(error) => {
                kill(&mut child);
                return Err(Failure::Wait(error));
            }
        }
    };
    let drained_by = Instant::now() + DRAIN_TIMEOUT;
    Ok(Finished {
        status,
        stdout: stdout.collect(drained_by),
        stderr: stderr.collect(drained_by),
    })
}

/// Starts `command` in a session of its own, with no controlling terminal and
/// its own process group (whose id is its pid), so killing `-pid` ends it and
/// everything it started. Without this, when AE itself has a terminal (`tauri
/// dev`), an interactive shell or a hook that wants the terminal is stopped by
/// the system and hangs until the timeout. Without a terminal, it fails at once.
#[cfg(unix)]
fn in_new_session(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    // SAFETY: setsid is async-signal-safe, as pre_exec requires
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }
}

/// A pipe being read on a thread of its own
struct Reading {
    output: Arc<Mutex<Vec<u8>>>,
    /// Sent to when the pipe closes
    done: Receiver<()>,
}

impl Reading {
    /// Everything read, once the pipe closes or `deadline` passes, whichever
    /// is first
    fn collect(self, deadline: Instant) -> Vec<u8> {
        let _ = self
            .done
            .recv_timeout(deadline.saturating_duration_since(Instant::now()));
        let mut output = self.output.lock().unwrap_or_else(PoisonError::into_inner);
        std::mem::take(&mut *output)
    }
}

fn read_in_background<R: Read + Send + 'static>(pipe: Option<R>) -> Reading {
    let output = Arc::new(Mutex::new(Vec::new()));
    let (tx, done) = mpsc::channel();
    let read = Arc::clone(&output);
    std::thread::spawn(move || {
        if let Some(mut pipe) = pipe {
            let mut chunk = [0; 8192];
            loop {
                match pipe.read(&mut chunk) {
                    Ok(0) => break,
                    Ok(n) => read
                        .lock()
                        .unwrap_or_else(PoisonError::into_inner)
                        .extend_from_slice(&chunk[..n]),
                    Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
                    Err(_) => break,
                }
            }
        }
        let _ = tx.send(());
    });
    Reading { output, done }
}

/// Kills the process and everything it started. Only called before it's been
/// waited for, so its group id can't have been reused.
fn kill(child: &mut Child) {
    #[cfg(unix)]
    // SAFETY: signals only the process group created for this command
    unsafe {
        libc::kill(-(child.id() as libc::pid_t), libc::SIGKILL);
    }
    #[cfg(not(unix))]
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn keeps_what_was_printed_when_something_holds_the_output_open() {
        // The background `sleep` inherits stdout and stderr, so they stay
        // open after the shell exits
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "echo out; echo err >&2; /bin/sleep 3 & exit 0"]);
        let started = Instant::now();
        let finished = run(&mut command, Duration::from_secs(5)).ok().unwrap();
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_eq!(finished.stdout, b"out\n");
        assert_eq!(finished.stderr, b"err\n");
    }
}
