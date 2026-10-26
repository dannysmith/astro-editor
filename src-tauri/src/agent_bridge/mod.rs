//! Debug-only HTTP bridge that lets coding agents drive the running dev app.
//!
//! It listens on 127.0.0.1 and writes `{ port, token, pid }` to `agent-bridge.json`
//! in the app data dir. Every request must send the token in the
//! `x-agent-bridge-token` header, which keeps web pages in a browser out.
//! `scripts/app.ts` is the client.
//!
//! The endpoints stay generic (eval, snapshot, window size, appearance and
//! navigation). App-specific actions live in the frontend and are reached
//! through `/eval`.

mod snapshot;

use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, LogicalSize, Manager, Theme, WebviewWindow};
use tiny_http::{Header, Method, Request, Response, Server};

const PREFERRED_PORT: u16 = 1422;
const TOKEN_HEADER: &str = "x-agent-bridge-token";
const INFO_FILE: &str = "agent-bridge.json";
const DEFAULT_EVAL_TIMEOUT_MS: u64 = 10_000;

/// Starts the bridge on a background thread. Called from `setup` in debug builds.
pub fn start(app: &AppHandle) {
    let server = match Server::http(("127.0.0.1", PREFERRED_PORT))
        .or_else(|_| Server::http(("127.0.0.1", 0)))
    {
        Ok(server) => server,
        Err(e) => {
            log::error!("Agent bridge failed to start: {e}");
            return;
        }
    };
    let Some(port) = server.server_addr().to_ip().map(|addr| addr.port()) else {
        log::error!("Agent bridge isn't bound to an IP address");
        return;
    };
    let token = uuid::Uuid::new_v4().to_string();

    let info = json!({ "port": port, "token": token, "pid": std::process::id() });
    let written = info_path(app).and_then(|path| {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(&path, info.to_string()).map_err(|e| e.to_string())
    });
    if let Err(e) = written {
        log::error!("Agent bridge couldn't write {INFO_FILE}: {e}");
        return;
    }
    log::info!("Agent bridge listening on 127.0.0.1:{port}");

    let app = app.clone();
    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            handle(&app, &token, request);
        }
    });
}

/// Removes the info file so the CLI doesn't find a dead bridge. Called on exit.
pub fn stop(app: &AppHandle) {
    if let Ok(path) = info_path(app) {
        let _ = std::fs::remove_file(path);
    }
}

fn info_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(INFO_FILE))
        .map_err(|e| e.to_string())
}

fn handle(app: &AppHandle, token: &str, mut request: Request) {
    let authorised = request
        .headers()
        .iter()
        .any(|h| h.field.equiv(TOKEN_HEADER) && h.value.as_str() == token);

    let (status, body) = if authorised {
        let mut body = String::new();
        let _ = request.as_reader().read_to_string(&mut body);
        let method = request.method().clone();
        match route(app, &method, request.url(), &body) {
            Ok(value) => (200, json!({ "ok": true, "value": value })),
            Err(error) => (200, json!({ "ok": false, "error": error })),
        }
    } else {
        (
            401,
            json!({ "ok": false, "error": "missing or wrong token" }),
        )
    };

    let header = Header::from_bytes("Content-Type", "application/json").expect("valid header");
    let response = Response::from_string(body.to_string())
        .with_status_code(status)
        .with_header(header);
    let _ = request.respond(response);
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EvalRequest {
    js: String,
    timeout_ms: Option<u64>,
}

#[derive(Deserialize)]
struct SnapshotRequest {
    path: PathBuf,
}

#[derive(Deserialize)]
struct WindowRequest {
    width: Option<f64>,
    height: Option<f64>,
    /// "light", "dark" or "system"
    theme: Option<String>,
    /// A path on the dev server, such as `/styleguide.html`
    url: Option<String>,
    #[serde(default)]
    reload: bool,
}

fn route(app: &AppHandle, method: &Method, url: &str, body: &str) -> Result<Value, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    match (method, url) {
        (Method::Get, "/health") => {
            let info = app.package_info();
            Ok(json!({
                "app": info.name,
                "version": info.version.to_string(),
                "pid": std::process::id(),
            }))
        }
        (Method::Post, "/eval") => {
            let req: EvalRequest = parse(body)?;
            let timeout = Duration::from_millis(req.timeout_ms.unwrap_or(DEFAULT_EVAL_TIMEOUT_MS));
            eval(&window, &req.js, timeout)
        }
        (Method::Post, "/snapshot") => {
            let req: SnapshotRequest = parse(body)?;
            let (width, height) = snapshot::capture(&window, &req.path)?;
            Ok(json!({ "path": req.path, "width": width, "height": height }))
        }
        (Method::Get, "/window") => window_info(&window),
        (Method::Post, "/window") => {
            let req: WindowRequest = parse(body)?;
            if let (Some(width), Some(height)) = (req.width, req.height) {
                window
                    .set_size(LogicalSize::new(width, height))
                    .map_err(|e| e.to_string())?;
            }
            if let Some(theme) = req.theme {
                let theme = match theme.as_str() {
                    "light" => Some(Theme::Light),
                    "dark" => Some(Theme::Dark),
                    "system" => None,
                    other => return Err(format!("unknown theme \"{other}\"")),
                };
                window.set_theme(theme).map_err(|e| e.to_string())?;
            }
            if let Some(path) = req.url {
                let current = window.url().map_err(|e| e.to_string())?;
                let url = current.join(&path).map_err(|e| e.to_string())?;
                window.navigate(url).map_err(|e| e.to_string())?;
            }
            if req.reload {
                window.reload().map_err(|e| e.to_string())?;
            }
            window_info(&window)
        }
        _ => Err(format!("no route for {method} {url}")),
    }
}

fn parse<T: for<'de> Deserialize<'de>>(body: &str) -> Result<T, String> {
    serde_json::from_str(body).map_err(|e| format!("bad request body: {e}"))
}

fn window_info(window: &WebviewWindow) -> Result<Value, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    let theme = window.theme().map_err(|e| e.to_string())?;
    Ok(json!({
        "width": size.width,
        "height": size.height,
        "scale": scale,
        "theme": match theme { Theme::Dark => "dark", _ => "light" },
    }))
}

/// Runs `js` as the body of an async function in the webview and returns its
/// JSON-serialisable result. `eval_with_callback` can't await promises, so the
/// function's outcome is stored on `window.__agentBridgeResults` and polled for.
fn eval(window: &WebviewWindow, js: &str, timeout: Duration) -> Result<Value, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let start = format!(
        r#"(() => {{
  const results = (window.__agentBridgeResults ??= {{}})
  const settle = result => {{ results["{id}"] = {{ done: true, ...result }} }}
  results["{id}"] = {{ done: false }}
  ;(async () => {{
{js}
  }})().then(
    value => {{
      try {{
        settle({{ ok: true, value: JSON.parse(JSON.stringify(value ?? null)) }})
      }} catch (error) {{
        settle({{ ok: false, error: `result isn't JSON-serialisable: ${{error}}` }})
      }}
    }},
    error => settle({{ ok: false, error: String(error) }})
  )
}})()"#
    );
    window.eval(start).map_err(|e| e.to_string())?;

    let poll = format!(
        r#"(() => {{
  const result = window.__agentBridgeResults?.["{id}"] ?? null
  if (result?.done) delete window.__agentBridgeResults["{id}"]
  return result
}})()"#
    );
    let deadline = Instant::now() + timeout;
    loop {
        let result = eval_sync(window, &poll)?;
        if result["done"] == true {
            return if result["ok"] == true {
                Ok(result["value"].clone())
            } else {
                Err(result["error"]
                    .as_str()
                    .unwrap_or("unknown error")
                    .to_string())
            };
        }
        if result.is_null() {
            return Err("eval result disappeared (did the page reload?)".to_string());
        }
        if Instant::now() > deadline {
            return Err(format!("eval timed out after {}ms", timeout.as_millis()));
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

/// Evaluates a synchronous expression and returns its value.
fn eval_sync(window: &WebviewWindow, js: &str) -> Result<Value, String> {
    let (tx, rx) = mpsc::channel();
    window
        .eval_with_callback(js, move |json| {
            let _ = tx.send(json);
        })
        .map_err(|e| e.to_string())?;
    let json = rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "webview didn't respond")?;
    if json.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&json).map_err(|e| format!("couldn't parse eval result: {e}"))
}
