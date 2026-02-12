# Custom External Editor Command

**Status:** Implemented

Replace the hardcoded IDE whitelist with a user-configurable command string.

## Problem

- Current whitelist limits users to 6 predefined editors
- Doesn't handle custom installation paths
- Breaks on Windows where binaries are in varied locations

## Solution

Allow users to enter any command in preferences (e.g., `code`, `/usr/local/bin/nvim`, `~/bin/my-editor`).

## Implementation

All items below have been completed.

### Rust (`src-tauri/src/commands/ide.rs`)

- ✅ Removed `ALLOWED_IDES` constant
- ✅ Removed `validate_ide_command()` function
- ✅ Removed `get_available_ides()` command
- ✅ Added `expand_tilde()` function for `~/` path expansion
- ✅ Added Zed to `get_augmented_path()` for macOS
- ✅ Kept all file path validation (shell injection protection)
- ✅ Kept `get_augmented_path()` for simple commands in signed macOS apps

### Frontend

- ✅ `src/components/preferences/panes/GeneralPane.tsx`: Replaced dropdown with text input
- ✅ `src/hooks/useAvailableIdes.ts`: Deleted
- ✅ `src/lib/commands/app-commands.ts`: Removed `ALLOWED_IDES` export

### UI Text Changes

- ✅ `src/components/ui/context-menu.tsx`: Changed to `Open in IDE`
- ✅ `src/lib/ide.ts`: Changed toast to `Opened in IDE`

### Error Message

- ✅ Updated to: "Command not found. Try using the full path to your editor in Preferences."

### Remove Unused Shell Plugin

- ✅ `src-tauri/Cargo.toml`: Removed `tauri-plugin-shell`
- ✅ `package.json`: Removed `@tauri-apps/plugin-shell`
- ✅ `src-tauri/src/lib.rs`: Removed `.plugin(tauri_plugin_shell::init())`
- ✅ `src-tauri/capabilities/default.json`: Removed `shell:allow-execute` section

## Upgrade Path

No migration needed. Existing values like `"ideCommand": "cursor"` continue to work.

## Security Notes

- No new vulnerabilities: user explicitly configures command, `Command::new().arg()` prevents shell injection
- Same approach as VS Code, Joplin, Typora
- File path validation remains intact
