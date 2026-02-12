# Custom External Editor Command

Replace the hardcoded IDE whitelist with a user-configurable command string.

## Problem

- Current whitelist limits users to 6 predefined editors
- Doesn't handle custom installation paths
- Breaks on Windows where binaries are in varied locations

## Solution

Allow users to enter any command in preferences (e.g., `code`, `/usr/local/bin/nvim`, `~/bin/my-editor`).

## Implementation

### Rust (`src-tauri/src/commands/ide.rs`)

**Remove:**
- `ALLOWED_IDES` constant
- `validate_ide_command()` function
- `get_available_ides()` command

**Keep:**
- All file path validation (shell injection protection)
- `get_augmented_path()` - still needed for simple commands in signed macOS apps

**Add:**
- Tilde expansion for the command (use existing `dirs` crate):
  ```rust
  fn expand_tilde(cmd: &str) -> String {
      if cmd.starts_with("~/") {
          if let Some(home) = dirs::home_dir() {
              return format!("{}{}", home.display(), &cmd[1..]);
          }
      }
      cmd.to_string()
  }
  ```
- Add Zed to `get_augmented_path()` for macOS:
  ```rust
  "/Applications/Zed.app/Contents/MacOS/cli"
  ```

**Note:** PATH augmentation is harmless for full paths - when `Command::new("/full/path")` is used, PATH is simply not consulted. No conditional logic needed.

### Frontend

- `src/components/preferences/panes/GeneralPane.tsx`: Replace dropdown with text input
- `src/hooks/useAvailableIdes.ts`: Delete
- `src/lib/commands/app-commands.ts`: Remove `ALLOWED_IDES` export

**Add help text under the input:**
> The command to launch your editor. Eg: `/usr/local/bin/nvim`. You can use `code` or `cursor` if installed in a standard location, use a full path if in doubt.

### UI Text Changes

Change these to always say "IDE" instead of showing the command name:

- `src/components/ui/context-menu.tsx:180`: Change `Open in ${ideCommand}` → `Open in IDE`
- `src/lib/ide.ts:28`: Change `Opened in ${ideCommand}` → `Opened in IDE`

### Improve Error Message

Update the "not found" error in `src-tauri/src/commands/ide.rs` (around line 218):

**Current:**
> "IDE 'nvim' not found. Make sure it's installed and available in PATH."

**New:**
> "Command not found. Try using the full path to your editor in Preferences."

### Remove Unused Shell Plugin

The Tauri shell plugin is installed but never used. Remove it:

- `src-tauri/Cargo.toml`: Remove `tauri-plugin-shell`
- `package.json`: Remove `@tauri-apps/plugin-shell`
- `src-tauri/src/lib.rs:50`: Remove `.plugin(tauri_plugin_shell::init())`
- `src-tauri/capabilities/default.json`: Remove `shell:allow-execute` section (lines 45-85)

## Upgrade Path

No migration needed. Existing values like `"ideCommand": "cursor"` are already valid command names that will continue to work with the augmented PATH.

## Security Notes

- No new vulnerabilities: user explicitly configures command, `Command::new().arg()` prevents shell injection
- Same approach as VS Code, Joplin, Typora
- File path validation remains intact
