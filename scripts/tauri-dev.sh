#!/usr/bin/env bash
# `bun run tauri:dev`: runs `tauri dev` with the dev identity (tauri.dev.conf.json).
# On macOS it also copies the output (Vite, cargo and the app's stdout) to
# tauri-dev.log in the dev log folder, where `bun run app logs` reads it. The
# file is replaced on each run.
set -euo pipefail
cd "$(dirname "$0")/.."

config=src-tauri/tauri.dev.conf.json
if [[ "$(uname)" != Darwin ]]; then
  exec tauri dev --config "$config" "$@"
fi

identifier=$(bun --print "require('./$config').identifier")
log_dir="$HOME/Library/Logs/$identifier"
mkdir -p "$log_dir"

# Output goes through tee, so colours have to be forced on for the terminal
CARGO_TERM_COLOR=always FORCE_COLOR=1 tauri dev --config "$config" "$@" 2>&1 |
  tee "$log_dir/tauri-dev.log"
