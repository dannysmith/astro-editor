//! Remembers the main window's size and position, and whether it's maximised or
//! full screen, in `window-state.json` in the app's data folder.
//!
//! Size is kept in points, so the window opens the same size on any display.
//! Position is kept in points on macOS, where every display shares one
//! coordinate space in points, and in pixels elsewhere, where they share one in
//! pixels. Keeping size in pixels (as tauri-plugin-window-state does) made the
//! window reopen at twice its size, again and again, when it was saved on a
//! Retina display and restored on a 1x one.
//!
//! The state is kept up to date as the window moves and resizes, since by the
//! time the app exits the window may be gone, and it's written to disk when the
//! window is closed and when the app exits.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    path::BaseDirectory, AppHandle, LogicalPosition, LogicalSize, Manager, Monitor,
    PhysicalPosition, Runtime, WebviewWindow,
};

pub(crate) const FILE_NAME: &str = "window-state.json";

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowState {
    /// The content's size, in points
    width: f64,
    height: f64,
    /// The window's top-left corner: points on macOS, pixels elsewhere. None
    /// where it can't be read, as on Wayland.
    position: Option<[f64; 2]>,
    maximized: bool,
    fullscreen: bool,
}

/// A display's area, in the same units as `WindowState`'s position
#[derive(Debug, Clone, Copy)]
struct Area {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// The main window's latest state, as it was last seen
#[derive(Default)]
pub struct WindowStateCache(Mutex<Option<WindowState>>);

/// Applies the saved state to the window, if there is one. A position on a
/// display that's no longer connected is skipped, so the window stays centred
/// on the main display.
pub fn restore<R: Runtime>(window: &WebviewWindow<R>) {
    let Some(state) = state_path(window.app_handle())
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|json| serde_json::from_str::<WindowState>(&json).ok())
    else {
        return;
    };

    let displays: Vec<Area> = window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(display_area)
        .collect();
    // Position first: on Windows, moving to a display with another scale
    // resizes the window, and the size below then corrects it
    if let Some([x, y]) = state.position.filter(|&p| is_on_a_display(p, &displays)) {
        let _ = if cfg!(target_os = "macos") {
            window.set_position(LogicalPosition::new(x, y))
        } else {
            window.set_position(PhysicalPosition::new(x, y))
        };
    }
    let _ = window.set_size(LogicalSize::new(state.width, state.height));
    if state.maximized {
        let _ = window.maximize();
    }
    if state.fullscreen {
        let _ = window.set_fullscreen(true);
    }

    if let Some(cache) = window.try_state::<WindowStateCache>() {
        *cache.0.lock().unwrap() = Some(state);
    }
}

/// Records the window's state after it moves or resizes
pub fn track<R: Runtime>(window: &WebviewWindow<R>) {
    let Some(cache) = window.try_state::<WindowStateCache>() else {
        return;
    };
    let mut cached = cache.0.lock().unwrap();
    if let Some(state) = current_state(window, *cached) {
        *cached = Some(state);
    }
}

/// Writes the window's last state to disk
pub fn save<R: Runtime>(app: &AppHandle<R>) {
    let Some(state) = app
        .try_state::<WindowStateCache>()
        .and_then(|cache| *cache.0.lock().unwrap())
    else {
        return;
    };
    let Some(path) = state_path(app) else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let written = serde_json::to_string_pretty(&state)
        .map_err(|e| e.to_string())
        .and_then(|json| std::fs::write(&path, json).map_err(|e| e.to_string()));
    if let Err(e) = written {
        log::warn!("Astro Editor [WINDOW_STATE] Couldn't save the window state: {e}");
    }
}

fn state_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .resolve(FILE_NAME, BaseDirectory::AppLocalData)
        .ok()
}

/// The window's state now. While it's maximised or full screen, its normal
/// size and position are kept from `previous`, to go back to; while it's
/// minimised, nothing changes.
fn current_state<R: Runtime>(
    window: &WebviewWindow<R>,
    previous: Option<WindowState>,
) -> Option<WindowState> {
    if window.is_minimized().unwrap_or(false) {
        return previous;
    }
    // macOS reports an undecorated window as maximised whenever it fills the
    // screen (tauri#5812), and ours is undecorated, so it's never counted
    let maximized = !cfg!(target_os = "macos") && window.is_maximized().unwrap_or(false);
    let fullscreen = window.is_fullscreen().unwrap_or(false);
    if maximized || fullscreen {
        return previous.map(|state| WindowState {
            maximized,
            fullscreen,
            ..state
        });
    }

    let scale = window.scale_factor().ok()?;
    let size = window.inner_size().ok()?.to_logical::<f64>(scale);
    let position = match window.outer_position() {
        Ok(position) if cfg!(target_os = "macos") => {
            let logical = position.to_logical::<f64>(scale);
            Some([logical.x, logical.y])
        }
        Ok(position) => Some([f64::from(position.x), f64::from(position.y)]),
        Err(_) => previous.and_then(|state| state.position),
    };
    Some(WindowState {
        width: size.width,
        height: size.height,
        position,
        maximized: false,
        fullscreen: false,
    })
}

fn display_area(monitor: &Monitor) -> Area {
    let (position, size) = (monitor.position(), monitor.size());
    if cfg!(target_os = "macos") {
        let scale = monitor.scale_factor();
        let position = position.to_logical::<f64>(scale);
        let size = size.to_logical::<f64>(scale);
        Area {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        }
    } else {
        Area {
            x: f64::from(position.x),
            y: f64::from(position.y),
            width: f64::from(size.width),
            height: f64::from(size.height),
        }
    }
}

/// Whether a window at `position` would have its title bar on a display, so
/// it can be dragged
fn is_on_a_display(position: [f64; 2], displays: &[Area]) -> bool {
    let (x, y) = (position[0] + 40.0, position[1] + 10.0);
    displays.iter().any(|display| {
        x >= display.x
            && x < display.x + display.width
            && y >= display.y
            && y < display.y + display.height
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restores_a_position_only_on_a_connected_display() {
        let laptop = Area {
            x: 0.0,
            y: 0.0,
            width: 1512.0,
            height: 982.0,
        };
        let external_to_the_left = Area {
            x: -1920.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };
        let displays = [laptop, external_to_the_left];

        assert!(is_on_a_display([100.0, 50.0], &displays));
        assert!(is_on_a_display([-1800.0, 50.0], &displays));
        // On a display that's been unplugged
        assert!(!is_on_a_display([2000.0, 50.0], &[laptop]));
        // Its title bar above the top of every display
        assert!(!is_on_a_display([100.0, -200.0], &displays));
    }
}
