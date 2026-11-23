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

/// How long a timed-out process gets to exit after being asked to, before
/// it's killed. Git removes its lock files when asked, so a killed commit
/// doesn't leave an `index.lock` behind for the next one to trip on.
#[cfg(unix)]
const STOP_GRACE: Duration = Duration::from_secs(2);

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
    /// It took longer than the timeout and was stopped, with everything it
    /// started
    TimedOut,
}

/// Runs `command` with stdin closed, where everything it starts can be
/// stopped with it (a session of its own on Unix, see `in_new_session`; a job
/// object on Windows), reading its output on other threads so a process that
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
    #[cfg(windows)]
    let job = windows_job::Job::holding(&child);
    let stdout = read_in_background(child.stdout.take());
    let stderr = read_in_background(child.stderr.take());

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            result => {
                #[cfg(unix)]
                stop(&mut child);
                #[cfg(windows)]
                stop(&mut child, job.as_ref());
                return Err(match result {
                    Err(error) => Failure::Wait(error),
                    _ => Failure::TimedOut,
                });
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
/// its own process group (whose id is its pid), so signalling `-pid` reaches
/// it and everything it started. Without this, when AE itself has a terminal
/// (`tauri dev`), an interactive shell or a hook that wants the terminal is
/// stopped by the system and hangs until the timeout. Without a terminal, it
/// fails at once.
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
    /// `None` once collected, after which the thread only drains the pipe
    output: Arc<Mutex<Option<Vec<u8>>>>,
    /// Sent to when the pipe closes
    done: Receiver<()>,
}

impl Reading {
    /// Everything read, once the pipe closes or `deadline` passes, whichever
    /// is first. A pipe still open after that (held by something running in
    /// the background) is drained and its output dropped, so it can't block
    /// the process writing to it, or pile up unread.
    fn collect(self, deadline: Instant) -> Vec<u8> {
        let _ = self
            .done
            .recv_timeout(deadline.saturating_duration_since(Instant::now()));
        let mut output = self.output.lock().unwrap_or_else(PoisonError::into_inner);
        output.take().unwrap_or_default()
    }
}

fn read_in_background<R: Read + Send + 'static>(pipe: Option<R>) -> Reading {
    let output = Arc::new(Mutex::new(Some(Vec::new())));
    let (tx, done) = mpsc::channel();
    let read = Arc::clone(&output);
    std::thread::spawn(move || {
        if let Some(mut pipe) = pipe {
            let mut chunk = [0; 8192];
            loop {
                match pipe.read(&mut chunk) {
                    Ok(0) => break,
                    Ok(n) => {
                        let mut kept = read.lock().unwrap_or_else(PoisonError::into_inner);
                        if let Some(kept) = kept.as_mut() {
                            kept.extend_from_slice(&chunk[..n]);
                        }
                    }
                    Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
                    Err(_) => break,
                }
            }
        }
        let _ = tx.send(());
    });
    Reading { output, done }
}

/// Stops the process and everything it started: asks them to end
/// (`SIGTERM`), gives the process `STOP_GRACE` to do so, then kills whatever
/// is left. Called before the process has been waited for, and it's only
/// reaped at the end, so its group id can't have been reused meanwhile.
#[cfg(unix)]
fn stop(child: &mut Child) {
    let group = -(child.id() as libc::pid_t);
    // SAFETY: signals only the process group created for this command
    unsafe { libc::kill(group, libc::SIGTERM) };
    let deadline = Instant::now() + STOP_GRACE;
    while Instant::now() < deadline && !has_exited(child) {
        std::thread::sleep(Duration::from_millis(20));
    }
    // SAFETY: as above; anything that ignored the request
    unsafe { libc::kill(group, libc::SIGKILL) };
    let _ = child.wait();
}

/// Whether the process has exited, leaving it to be waited for
#[cfg(unix)]
fn has_exited(child: &Child) -> bool {
    // SAFETY: a zeroed siginfo_t is valid, and WNOWAIT leaves the process
    // unreaped. With WNOHANG, nothing is filled in until it has exited
    unsafe {
        let mut info: libc::siginfo_t = std::mem::zeroed();
        libc::waitid(
            libc::P_PID,
            child.id() as libc::id_t,
            &mut info,
            libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
        ) == 0
            && info.si_signo != 0
    }
}

/// Kills the process, and everything it started if it's in a job
#[cfg(windows)]
fn stop(child: &mut Child, job: Option<&windows_job::Job>) {
    match job {
        Some(job) => job.terminate(),
        None => {
            let _ = child.kill();
        }
    }
    let _ = child.wait();
}

/// A Windows job object, so a timed-out git can be ended with the hooks and
/// credential helpers it started, as a process group is on Unix
#[cfg(windows)]
mod windows_job {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, TerminateJobObject,
    };

    pub struct Job(HANDLE);

    impl Job {
        /// A new job holding `child`, and whatever it starts from now on.
        /// `None` if it can't be made; then only `child` can be killed.
        pub fn holding(child: &Child) -> Option<Job> {
            // SAFETY: a new unnamed job with default security, closed if it
            // can't take the process
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if job.is_null() {
                    return None;
                }
                if AssignProcessToJobObject(job, child.as_raw_handle() as HANDLE) == 0 {
                    CloseHandle(job);
                    return None;
                }
                Some(Job(job))
            }
        }

        /// Ends every process in the job
        pub fn terminate(&self) {
            // SAFETY: the handle is open until drop
            unsafe { TerminateJobObject(self.0, 1) };
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            // SAFETY: closed once, here. Processes still in the job carry on
            unsafe { CloseHandle(self.0) };
        }
    }
}

/// For tests: whether the process `pid` has gone, given up to two seconds.
/// One that has ended but not been reaped yet (a zombie, which `kill(pid, 0)`
/// still finds on Linux) counts as gone.
#[cfg(all(test, unix))]
pub fn has_gone(pid: i32) -> bool {
    let zombie = || {
        std::fs::read_to_string(format!("/proc/{pid}/stat"))
            .ok()
            .and_then(|stat| {
                stat.rsplit(')')
                    .next()
                    .map(|rest| rest.trim_start().starts_with('Z'))
            })
            .unwrap_or(false)
    };
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        // SAFETY: signal 0 only checks the process exists
        if unsafe { libc::kill(pid, 0) } != 0 || zombie() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
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

    #[test]
    fn a_timed_out_process_is_asked_to_end_before_it_is_killed() {
        let dir = tempfile::TempDir::new().unwrap();
        let cleaned = dir.path().join("cleaned");
        // Like git removing its lock files on SIGTERM
        let mut command = Command::new("/bin/sh");
        command.arg("-c").arg(format!(
            "trap 'touch \"{}\"; exit 1' TERM; while :; do /bin/sleep 0.05; done",
            cleaned.display()
        ));
        let started = Instant::now();
        assert!(matches!(
            run(&mut command, Duration::from_millis(300)),
            Err(Failure::TimedOut)
        ));
        assert!(cleaned.exists(), "it wasn't asked to end");
        assert!(started.elapsed() < STOP_GRACE + Duration::from_secs(1));
    }

    #[test]
    fn a_process_that_ignores_the_request_is_killed() {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "trap '' TERM; while :; do /bin/sleep 0.05; done"]);
        let started = Instant::now();
        assert!(matches!(
            run(&mut command, Duration::from_millis(300)),
            Err(Failure::TimedOut)
        ));
        let took = started.elapsed();
        assert!(took >= STOP_GRACE && took < STOP_GRACE + Duration::from_secs(2));
    }
}
