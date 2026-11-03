//! Quitting saves unsaved edits first. Every way of quitting calls
//! `request_quit`, which emits `quit-requested`; the frontend saves the open
//! file and answers with `quit_app`, or `cancel_quit` if the save failed and the
//! writer chose not to quit.
//!
//! - macOS: Cmd+Q (AppKit's own Quit item), Quit from the Dock, logout and
//!   shutdown all send `terminate:`, which `RunEvent::ExitRequested` doesn't
//!   see (tauri#9198) and tao's app delegate doesn't handle.
//!   `install_terminate_hook` adds `applicationShouldTerminate:` to that
//!   delegate, so AppKit waits for the frontend before terminating.
//! - Windows and Linux: closing the main window, or the Quit menu item, calls
//!   `request_quit`.
//!
//! If the frontend doesn't answer within `QUIT_TIMEOUT` (the webview hung, or
//! the page hasn't loaded yet), the app quits anyway, and if that doesn't end
//! the process either, it exits outright: a hang is worse than losing edits.
//!
//! On macOS, never send `terminate:` or reply to it from inside a tao event
//! callback (a menu event, a Tauri command, `run_on_main_thread` on the main
//! thread). AppKit waits for the reply in a nested run loop, and while tao is in
//! a callback it handles nothing, so the reply never comes; and when AppKit
//! does terminate, tao's `applicationWillTerminate` takes the lock that
//! callback holds. Both hang the main thread. Replies go through the GCD main
//! queue, which runs only once tao's callback has returned.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const QUIT_TIMEOUT: Duration = Duration::from_secs(5);

/// How long quitting normally gets after the timeout before the process exits
const FORCE_QUIT_DELAY: Duration = Duration::from_secs(3);

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// The quit request the frontend hasn't answered yet, if any
static PENDING_REQUEST: Mutex<Option<u64>> = Mutex::new(None);

/// Asks the frontend to save and then quit. Does nothing if it's already been
/// asked and hasn't answered.
pub fn request_quit(app: &AppHandle) {
    let id = {
        let mut pending = PENDING_REQUEST.lock().unwrap();
        if pending.is_some() {
            return;
        }
        let id = NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        *pending = Some(id);
        id
    };

    log::info!("Quit requested, asking the frontend to save first");
    let _ = app.emit("quit-requested", ());

    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(QUIT_TIMEOUT);
        // Check and take the request in one step, so a `cancel_quit` in between
        // can't be overridden
        {
            let mut pending = PENDING_REQUEST.lock().unwrap();
            if *pending != Some(id) {
                return;
            }
            *pending = None;
        }
        log::warn!("The frontend didn't answer the quit request, quitting anyway");
        finish(&app, true, true);

        // Still running means the main thread is stuck
        std::thread::sleep(FORCE_QUIT_DELAY);
        log::error!("Quitting didn't end the app, exiting the process");
        log::logger().flush();
        std::process::exit(0);
    });
}

/// Quits once unsaved edits are saved (or the writer chose to quit without them).
#[tauri::command]
#[specta::specta]
pub fn quit_app(app: AppHandle) {
    finish(&app, true, take_pending_request());
}

/// Stays open: the save failed and the writer is being asked what to do.
#[tauri::command]
#[specta::specta]
pub fn cancel_quit(app: AppHandle) {
    finish(&app, false, take_pending_request());
}

/// Clears the unanswered request. Returns whether there was one.
fn take_pending_request() -> bool {
    PENDING_REQUEST.lock().unwrap().take().is_some()
}

/// `was_pending` says whether this answers a request, which on macOS means
/// AppKit is waiting for the reply.
fn finish(app: &AppHandle, quit: bool, was_pending: bool) {
    // AppKit is waiting on `applicationShouldTerminate:` and terminates itself
    #[cfg(target_os = "macos")]
    if was_pending {
        dispatch2::DispatchQueue::main().exec_async(move || {
            let mtm =
                objc2::MainThreadMarker::new().expect("the main queue runs on the main thread");
            objc2_app_kit::NSApplication::sharedApplication(mtm)
                .replyToApplicationShouldTerminate(quit);
        });
        return;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = was_pending;

    if quit {
        app.exit(0);
    }
}

#[cfg(target_os = "macos")]
static APP_HANDLE: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

/// Adds `applicationShouldTerminate:` to tao's app delegate class. Call from
/// `setup()`, on the main thread, once the event loop has set the delegate.
#[cfg(target_os = "macos")]
pub fn install_terminate_hook(app: &AppHandle) {
    use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
    use objc2::{sel, Encode};
    use objc2_app_kit::{NSApplication, NSApplicationTerminateReply};

    extern "C-unwind" fn application_should_terminate(
        _this: &AnyObject,
        _cmd: Sel,
        _sender: *mut AnyObject,
    ) -> NSApplicationTerminateReply {
        match APP_HANDLE.get() {
            Some(app) => {
                request_quit(app);
                NSApplicationTerminateReply::TerminateLater
            }
            None => NSApplicationTerminateReply::TerminateNow,
        }
    }

    let _ = APP_HANDLE.set(app.clone());

    let mtm = objc2::MainThreadMarker::new().expect("setup runs on the main thread");
    let ns_app = NSApplication::sharedApplication(mtm);
    let Some(delegate) = ns_app.delegate() else {
        log::warn!("No app delegate, so quitting won't save unsaved edits");
        return;
    };

    let class: *const AnyClass = AsRef::<AnyObject>::as_ref(&*delegate).class();
    // Return type, self, _cmd, sender
    let types = format!("{}@:@\0", NSApplicationTerminateReply::ENCODING);
    let added = unsafe {
        let imp: Imp = std::mem::transmute(
            application_should_terminate
                as extern "C-unwind" fn(_, _, _) -> NSApplicationTerminateReply,
        );
        objc2::ffi::class_addMethod(
            class.cast_mut(),
            sel!(applicationShouldTerminate:),
            imp,
            types.as_ptr().cast(),
        )
        .as_bool()
    };
    if !added {
        // tao has started handling it itself, so this hook needs revisiting
        log::warn!("The app delegate already has applicationShouldTerminate:");
        return;
    }

    // Set the delegate again in case NSApplication cached which methods it has
    ns_app.setDelegate(Some(&*delegate));
}
