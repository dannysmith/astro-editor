# Logging in Astro Editor

Astro Editor uses [Tauri's log plugin](https://v2.tauri.app/plugin/log) to integrate with macOS's native logging system.

## Getting Support Logs

**For Support Issues:**

**Option 1: Complete Log File (Recommended)**
1. Open Finder and navigate to: `~/Library/Logs/is.danny.astroeditor/`
2. Copy the file `Astro Editor.log` 
3. Send this file along with a description of your issue

**Option 2: Console.app for Live Monitoring**
1. Open Console.app (`/Applications/Utilities/Console.app`)
2. Search for "Astro Editor" to see all app logs
3. For project setup issues specifically, search for "Astro Editor [PROJECT_SETUP]"
4. Copy the relevant logs and send them to support

**Note:** The complete log file contains all historical logs and is usually more helpful for debugging than individual Console.app entries.

**Common Search Terms:**

- `Astro Editor` - All app logs including startup info with version
- `Astro Editor [PROJECT_SETUP]` - Step-by-step project setup process
- `Astro Editor [PROJECT_SCAN]` - Backend project scanning operations
- `Astro Editor [PROJECT_DISCOVERY]` - Project metadata discovery
- `Astro Editor [JS_ERROR]` - JavaScript runtime errors
- `Astro Editor [PROMISE_REJECTION]` - Unhandled promise rejections

## Viewing Logs

**Console.app (Recommended):**

1. Open Console.app (`/Applications/Utilities/Console.app`)
2. Search for one of the terms above based on your issue
3. View real-time logs from the app

**Terminal:**

```bash
# View complete log file (most helpful)
cat "~/Library/Logs/is.danny.astroeditor/Astro Editor.log"

# View recent log file entries
tail -50 "~/Library/Logs/is.danny.astroeditor/Astro Editor.log"

# Search log file for specific issues
grep "[PROJECT_SETUP]" "~/Library/Logs/is.danny.astroeditor/Astro Editor.log"

# Live system logs (less detailed than log file)
log stream --predicate 'process == "astro-editor"'
```

## Available Log Levels

```typescript
import { trace, debug, info, warn, error } from '@tauri-apps/plugin-log'

await trace('Very detailed debugging info')
await debug('Development debugging info')
await info('General information')
await warn('Warning messages')
await error('Error messages')
```

### Rust Backend Logging

For logging from Rust commands, use the standard `log` crate which integrates with the Tauri log plugin:

```rust
use log::{debug, error, info, warn};

// Usage in Tauri commands
#[tauri::command]
pub async fn my_command() -> Result<String, String> {
    info!("Command started");
    debug!("Debug information with variable: {some_var}");
    warn!("Warning about something: {warning_msg}");
    error!("Error occurred: {error_msg}");

    Ok("Success".to_string())
}
```

**Rust Log Levels:**

- `debug!()` - Development debugging info
- `info!()` - General information
- `warn!()` - Warning messages
- `error!()` - Error messages

**Note:** Use modern Rust formatting (`{variable}`) instead of old-style (`{}`, variable) to satisfy clippy linting.

## What Gets Logged

**App Startup:**

- App version and platform information
- Initialization status

**Project Setup (`[PROJECT_SETUP]` tag):**

- Step-by-step project setup process
- Project path being opened
- Project ID generation
- Settings loading
- File watcher initialization
- Complete success/failure status

**Project Scanning (`[PROJECT_SCAN]` tag):**

- Project directory scanning
- Content directory detection
- Collection discovery
- Astro config parsing attempts
- Fallback directory scanning

**Project Discovery (`[PROJECT_DISCOVERY]` tag):**

- Package.json reading attempts
- Project name extraction
- Project ID generation
- Fallback discovery methods

**Error Handling:**

- JavaScript runtime errors (`[JS_ERROR]`)
- Unhandled promise rejections (`[PROMISE_REJECTION]`)
- All project setup failures with context
- File system access errors
- Configuration parsing errors

**Auto-Updater:**

- Update detection
- Download progress
- Installation status
- Error reporting

**File Operations:**

- File opening failures (Rust backend)
- Save failures and recovery (Rust backend)
- Recovery data saves (Rust backend)
- Crash report saves (Rust backend)

**IDE Integration:**

- IDE command execution attempts (Rust backend)
- PATH environment fixes (Rust backend)
- Command failures and suggestions (Rust backend)

**Security Operations:**

- Blocked directory access attempts (Rust backend)
- Path validation failures (Rust backend)

## Links

- [Tauri Log Plugin Documentation](https://v2.tauri.app/plugin/log)
- [macOS Console.app Guide](https://support.apple.com/guide/console/welcome/mac)
