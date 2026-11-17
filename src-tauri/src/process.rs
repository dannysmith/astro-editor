//! Running a child process with a timeout: the git runner (`git::runner`) and
//! the login-shell PATH lookup (`shell_path`).

use std::io::{self, Read};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::time::{Duration, Instant};

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
/// by something it left running in the background gets half a second.
pub fn run(command: &mut Command, timeout: Duration) -> Result<Finished, Failure> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    in_new_session(command);
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
    let collect = |rx: Receiver<Vec<u8>>| {
        rx.recv_timeout(Duration::from_millis(500))
            .unwrap_or_default()
    };
    Ok(Finished {
        status,
        stdout: collect(stdout),
        stderr: collect(stderr),
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

fn read_in_background<R: Read + Send + 'static>(pipe: Option<R>) -> Receiver<Vec<u8>> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut output = Vec::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_end(&mut output);
        }
        let _ = tx.send(output);
    });
    rx
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
