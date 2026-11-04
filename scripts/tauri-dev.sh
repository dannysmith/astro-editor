#!/usr/bin/env bash
# `bun run tauri:dev`: runs `tauri dev` with this checkout's dev identity, which is
# tauri.dev.conf.json plus the overlay for its dev slot (scripts/dev-slot.ts):
# identifier, product name and Vite port. On macOS it also copies the output
# (Vite, cargo and the app's stdout) to tauri-dev.log in that identity's log
# folder, where `bun run app logs` reads it. The file is replaced on each run.
set -euo pipefail
cd "$(dirname "$0")/.."

# Sets DEV_IDENTIFIER and DEV_OVERLAY, and exports the Vite port and window title.
# Assigned first so a failure stops the script.
launch=$(bun scripts/dev-slot.ts)
eval "$launch"

args=(--config src-tauri/tauri.dev.conf.json --config "$DEV_OVERLAY" "$@")
if [[ "$(uname)" != Darwin ]]; then
  exec tauri dev "${args[@]}"
fi

log_dir="$HOME/Library/Logs/$DEV_IDENTIFIER"
mkdir -p "$log_dir"

# Output goes through tee, so colours have to be forced on for the terminal
CARGO_TERM_COLOR=always FORCE_COLOR=1 tauri dev "${args[@]}" 2>&1 |
  tee "$log_dir/tauri-dev.log"
