# Migrate Telemetry to Pure Rust Implementation

## Problem

The current telemetry system uses the browser's `fetch()` API to send anonymous usage data to `https://updateserver.dny.li/event`. This causes CORS errors in development mode:

```
[Error] The network connection was lost.
[Error] Fetch API cannot load https://updateserver.dny.li/event due to access control checks.
[Error] Failed to load resource: The network connection was lost.
[Error] Telemetry event failed: – TypeError: Load failed
```

### Root Cause

In Tauri development mode, the app runs from `http://localhost:1420`. When JavaScript's `fetch()` makes a request to an external HTTPS endpoint, WebKit enforces strict CORS policies. The server must explicitly allow `http://localhost:1420` as an origin.

In production, the app runs from `tauri://localhost`, which has different security characteristics, so this issue doesn't occur there.

**The solution:** Move telemetry entirely to Rust using `reqwest`. Backend Rust code is not subject to CORS restrictions or Tauri's permission system.

## Solution: Pure Rust Implementation

Move telemetry entirely to Rust. Since the updater already runs in Rust (`lib.rs:60`), we can send telemetry from the same place on app startup.

**Advantages:**
- No JavaScript dependency
- Simpler architecture (one language)
- Smaller frontend bundle
- No CORS issues
- No Tauri permissions/capabilities needed (backend code is unrestricted)
- Works identically in dev and prod modes

## Implementation Steps

### Step 1: Add Dependencies to Cargo.toml

**File:** `src-tauri/Cargo.toml`

Add these two dependencies to the `[dependencies]` section (after line 46):

```toml
reqwest = { version = "0.12", features = ["json"] }
uuid = { version = "1.0", features = ["v4"] }
```

**Verification:** Your `[dependencies]` section should now have these new entries along with the existing ones like `tauri`, `serde`, `tokio`, etc.

### Step 2: Create Telemetry Module

**File:** `src-tauri/src/telemetry.rs` (new file)

Create this new file with the following content:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Telemetry data stored in app data directory
#[derive(Serialize, Deserialize)]
struct TelemetryData {
    uuid: String,
    created_at: String,
}

/// Payload sent to telemetry server
#[derive(Serialize)]
struct TelemetryPayload {
    #[serde(rename = "appId")]
    app_id: String,
    uuid: String,
    version: String,
    event: String,
    platform: String,
    timestamp: String,
}

/// Sends anonymous telemetry event to the update server.
/// Fails silently if the request fails - this should never block the user.
///
/// # Arguments
/// * `app_data_dir` - Path to the app's data directory
/// * `version` - Current app version
pub async fn send_telemetry_event(
    app_data_dir: PathBuf,
    version: String,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get or create UUID
    let uuid = get_or_create_uuid(&app_data_dir)?;

    // Build payload
    let payload = TelemetryPayload {
        app_id: "astro-editor".to_string(),
        uuid,
        version,
        event: "update_check".to_string(),
        platform: std::env::consts::OS.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    // Send request with 5 second timeout (same as JavaScript version)
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;

    client
        .post("https://updateserver.dny.li/event")
        .json(&payload)
        .send()
        .await?;

    Ok(())
}

/// Gets or creates a UUID for anonymous telemetry tracking.
/// The UUID is stored in telemetry.json in the app data directory and persists across sessions.
///
/// # Arguments
/// * `app_data_dir` - Path to the app's data directory
///
/// # File Format
/// ```json
/// {
///   "uuid": "550e8400-e29b-41d4-a716-446655440000",
///   "created_at": "2025-11-05T15:29:59.206Z"
/// }
/// ```
fn get_or_create_uuid(app_data_dir: &PathBuf) -> Result<String, Box<dyn std::error::Error>> {
    let telemetry_file = app_data_dir.join("telemetry.json");

    if telemetry_file.exists() {
        // Read existing UUID
        let contents = std::fs::read_to_string(&telemetry_file)?;
        let data: TelemetryData = serde_json::from_str(&contents)?;
        Ok(data.uuid)
    } else {
        // Create new UUID
        let uuid = uuid::Uuid::new_v4().to_string();
        let data = TelemetryData {
            uuid: uuid.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        // Ensure app data directory exists
        std::fs::create_dir_all(app_data_dir)?;

        // Write to file with pretty formatting
        std::fs::write(&telemetry_file, serde_json::to_string_pretty(&data)?)?;

        Ok(uuid)
    }
}
```

**Key Points:**
- Uses exact same JSON structure as current implementation: `{"uuid": "...", "created_at": "..."}`
- Uses exact same payload structure expected by Cloudflare Worker
- Uses exact same 5-second timeout as JavaScript version
- Fails silently if anything goes wrong (network error, file write error, etc.)
- Creates app data directory if it doesn't exist

### Step 3: Register Telemetry Module in lib.rs

**File:** `src-tauri/src/lib.rs`

**3a) Add module declaration** (after line 4, with other module declarations):

```rust
mod telemetry;
```

So it should look like:
```rust
mod commands;
mod models;
mod parser;
mod schema_merger;
mod telemetry;  // Add this line
```

**3b) Add telemetry call in setup** (inside the `.setup(|app| {` block, after the logging lines around line 81):

Find this section:
```rust
.setup(|app| {
    // Log app startup information
    let package_info = app.package_info();
    log::info!("Astro Editor v{} starting up", package_info.version);
    log::info!("Platform: {}", std::env::consts::OS);
    log::info!("Architecture: {}", std::env::consts::ARCH);
```

After the logging lines (around line 81), add:

```rust
    // Send telemetry on startup (non-blocking, fails silently)
    let app_handle = app.handle().clone();
    let version = package_info.version.to_string();
    tauri::async_runtime::spawn(async move {
        if let Ok(app_data_dir) = app_handle.path().app_local_data_dir() {
            let _ = telemetry::send_telemetry_event(app_data_dir, version).await;
        }
    });
```

**Why this approach:**
- Uses `async_runtime::spawn` to avoid blocking app startup
- Fails silently with `let _ =` (telemetry should never crash the app)
- Runs immediately on app startup, same timing as before
- Uses `app_local_data_dir()` which resolves to `~/Library/Application Support/is.danny.astroeditor/` on macOS

### Step 4: Remove JavaScript Telemetry Implementation

**4a) Delete TypeScript files:**

```bash
rm -f src/lib/telemetry.ts
rm -f src/lib/telemetry.test.ts
```

**4b) Remove import and call from App.tsx:**

**File:** `src/App.tsx`

Remove line 10:
```typescript
import { sendTelemetryEvent } from './lib/telemetry'  // DELETE THIS LINE
```

Remove lines 17-18 (inside the `checkForUpdates` function):
```typescript
const version = await getVersion()           // DELETE THIS LINE
sendTelemetryEvent(version).catch(() => {})  // DELETE THIS LINE
```

**Before:**
```typescript
const checkForUpdates = async (): Promise<boolean> => {
  try {
    const version = await getVersion()
    sendTelemetryEvent(version).catch(() => {})

    const update = await check()
```

**After:**
```typescript
const checkForUpdates = async (): Promise<boolean> => {
  try {
    const update = await check()
```

**Also remove the unused import at line 8:**
```typescript
import { getVersion } from '@tauri-apps/api/app'  // DELETE THIS (no longer used)
```

**Note:** The manual update check (line 82) uses `invoke('get_app_version')` instead, so the `getVersion` import is no longer needed.

### Step 5: Build and Test

**5a) Install Rust dependencies:**

```bash
cd src-tauri
cargo fetch
```

This downloads the new `reqwest` and `uuid` crates.

**5b) Run development mode:**

```bash
pnpm run tauri dev
```

**Expected behavior:**
- ✅ App starts without errors
- ✅ No CORS errors in browser console
- ✅ No telemetry errors in Rust logs
- ✅ Telemetry sends silently in background

**5c) Verify telemetry was sent:**

Check the database for new events:
```bash
cd telemetry-worker
pnpm wrangler d1 execute astro-telemetry --remote --command "
  SELECT * FROM telemetry_events
  WHERE app_id = 'astro-editor'
  ORDER BY created_at DESC
  LIMIT 5
"
```

You should see a new row with:
- Your UUID (same as in `~/Library/Application Support/is.danny.astroeditor/telemetry.json`)
- Current app version (from `tauri.conf.json`)
- Event: `update_check`
- Platform: `macos`
- Recent timestamp

**5d) Verify UUID persistence:**

```bash
# Check the UUID file exists and has correct format
cat ~/Library/Application\ Support/is.danny.astroeditor/telemetry.json
```

Should output:
```json
{
  "uuid": "some-uuid-here",
  "created_at": "2025-11-07T..."
}
```

**5e) Test production build:**

```bash
pnpm run tauri build
```

Install the built app from `src-tauri/target/release/bundle/macos/Astro Editor.app` and verify:
- App launches successfully
- Same UUID is used (persistent across dev/prod)
- Telemetry event appears in database

## Verification Checklist

After implementation, verify all these conditions:

### Functionality
- [ ] App starts in development mode without errors
- [ ] App starts in production mode without errors
- [ ] No CORS errors in browser console (dev mode)
- [ ] No telemetry errors in Rust logs
- [ ] Telemetry event appears in D1 database within 10 seconds of app launch
- [ ] Payload structure matches Cloudflare Worker expectations

### UUID Persistence
- [ ] `telemetry.json` file created on first launch if missing
- [ ] Same UUID used across app restarts
- [ ] Same UUID used in both dev and prod builds
- [ ] File format matches: `{"uuid": "...", "created_at": "..."}`

### Error Handling
- [ ] App doesn't crash if network is unavailable
- [ ] App doesn't crash if file write fails
- [ ] App doesn't crash if server is down
- [ ] No visible errors to the user in any failure case

### Code Quality
- [ ] All TypeScript telemetry files deleted (`telemetry.ts`, `telemetry.test.ts`)
- [ ] All telemetry imports removed from `App.tsx`
- [ ] No unused imports remaining
- [ ] Rust code compiles without warnings
- [ ] TypeScript compiles without errors

## Rollback Plan

If something goes wrong, you can quickly rollback:

```bash
# Rollback git changes
git checkout src/lib/telemetry.ts
git checkout src/lib/telemetry.test.ts
git checkout src/App.tsx
git checkout src-tauri/Cargo.toml
git checkout src-tauri/src/lib.rs
rm src-tauri/src/telemetry.rs
```

Then run:
```bash
pnpm run tauri dev
```

## Expected Payload

The Rust implementation sends this exact payload structure:

```json
{
  "appId": "astro-editor",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "version": "0.1.33",
  "event": "update_check",
  "platform": "macos",
  "timestamp": "2025-11-07T12:00:00.000Z"
}
```

This matches the Cloudflare Worker's expected format (`telemetry-worker/worker.js:45-46`).

## Common Issues & Solutions

### Issue: `reqwest` not found during compilation
**Solution:** Run `cargo fetch` in the `src-tauri` directory first.

### Issue: Telemetry not appearing in database
**Debug steps:**
1. Check Rust logs for errors: `tauri dev` output
2. Verify network connectivity: `curl https://updateserver.dny.li/event`
3. Check database: Run the D1 query in Step 5c
4. Verify UUID file exists: `cat ~/Library/Application\ Support/is.danny.astroeditor/telemetry.json`

### Issue: App data directory doesn't exist
**Expected behavior:** The Rust code creates it automatically. If it fails, check file permissions.

### Issue: UUID changes between launches
**Cause:** File read/write issue. Check that `telemetry.json` exists and is readable.

## Why This Approach Works

1. **No CORS:** Rust `reqwest` doesn't use WebKit, so no same-origin policy applies
2. **No Permissions:** Backend Rust code bypasses Tauri's permission system entirely
3. **Dev/Prod Identical:** Same Rust code runs in both modes, unlike JavaScript
4. **Smaller Bundle:** Removes ~2KB from frontend (telemetry.ts + test)
5. **Better Error Handling:** Rust's type system catches errors at compile time
6. **Already Async:** Project uses `tokio`, so async HTTP fits naturally

## References

- Current Implementation: `src/lib/telemetry.ts` (to be deleted)
- Telemetry Worker: `telemetry-worker/worker.js`
- App Data File Pattern: `src-tauri/src/commands/files.rs:848-888`
- Reqwest Docs: https://docs.rs/reqwest/latest/reqwest/
- UUID Crate Docs: https://docs.rs/uuid/latest/uuid/
