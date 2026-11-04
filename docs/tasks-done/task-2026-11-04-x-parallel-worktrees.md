# Parallel worktrees

## Problem

Danny works in one checkout of this repo: Claude Code and `bun run tauri:dev` in one terminal, VS Code alongside. He wants several features in progress at once, each with its own Claude session, dev app and VS Code window, without them interfering. Git worktrees are the obvious tool, but today a second `tauri:dev` can't run at all, and nothing sets up a new checkout.

The aim is for each checkout to identify itself: the dev launcher and `bun run app` work out which dev app is theirs from the checkout they run in. Then it doesn't matter what created the worktree (Claude, worktrunk, VS Code, the desktop app), and Claude needs no extra instructions to find its own app.

The same pattern should carry over to Danny's other Tauri, web and Xcode projects, so keep the approach generic where it costs nothing.

## Status

Built: dev slots (`scripts/dev-slot.ts`, used by `tauri-dev.sh`, `bun run app` and Vite), the window title, `bun run setup` (`scripts/setup.ts`), `.config/wt.toml`, and the docs (`agent-tooling.md`, `AGENTS.md`, `app-control` skill). Tested with two throwaway worktrees: slots 1 and 2 claimed, rerunning setup keeps the slot, the Rust build clones in about a second, and `bun run app` in a worktree looks for that worktree's app.

Left for Danny, since they're outside what Claude may change:

- [x] `.claude/settings.json` sandbox: list `is.danny.astroeditor.dev` and `.dev1` to `.dev4` in `allowRead` and `allowWrite` (auto mode refuses Claude editing its own sandbox). A `is.danny.astroeditor.dev*` glob let Claude list the folders but not read the files in them, so `bun run app` couldn't read the bridge file.
- [x] `brew install worktrunk && wt config shell install`
- [x] VS Code user settings: `git.detectWorktrees: true`, and `${activeRepositoryBranchName}` in `window.title`
- [ ] Restart `tauri:dev` in the main checkout (one app-crate rebuild) and check the title reads "Astro Editor (Dev · <branch>)". Restarted and rebuilt; title still to check once the sandbox fix is in
- [x] Try it for real: `wt switch -c <branch> -x claude`, approve the hook, run `bun run tauri:dev` in the new worktree, and check both apps run and `bun run app status` in each finds its own

## What blocked a second dev app

- **Vite port:** `vite.config.ts` uses port 1420 with `strictPort`, and `src-tauri/tauri.conf.json` hardcodes `devUrl: http://localhost:1420`. A second instance fails immediately.
- **Single-instance plugin:** `src-tauri/src/lib.rs` registers it on every desktop platform. On macOS it uses a socket named after the identifier (`/tmp/<identifier>_si.sock`), so a second dev app with the same identifier hands off to the first and quits. The comment there ("macOS is already single-instance") only holds for apps launched from Finder; `tauri dev` runs the binary directly.
- **Everything keyed by `is.danny.astroeditor.dev`:**
  - app data, preferences and window state are shared, so instances clobber each other
  - `tauri-dev.log` is replaced by whichever instance started last
  - `agent-bridge.json`: the last instance to start wins, and when either quits it deletes the file the other wrote, so `bun run app` drives the wrong app or none
  - the window title is hardcoded to "Astro Editor (Dev)"
- **Cargo `target/` is large** (4.4 GB after a fresh debug build; it had grown to 31 GB of stale artifacts from dependency updates). A new worktree starts empty, so its first build is a full rebuild.

The agent bridge's own port is fine: it falls back to a random free port.

## Plan

### Phase 1: dev slots

The main checkout keeps today's identity (slot 0). Each worktree claims the lowest free slot from 1 to 4 during setup and stores it in `dev-slot.local` at the worktree root (already gitignored by `*.local`). A slot is free when no other worktree in `git worktree list` has claimed it. The main checkout is the one where `git rev-parse --git-dir` equals `--git-common-dir`. A slot sets:

| Slot | Identifier                    | Product name       | Vite port  |
| ---- | ----------------------------- | ------------------ | ---------- |
| 0    | `is.danny.astroeditor.dev`    | Astro Editor Dev   | 1420       |
| n    | `is.danny.astroeditor.dev<n>` | Astro Editor Dev n | 1420 + 10n |

- `scripts/tauri-dev.sh` reads the slot and passes an inline overlay with `tauri dev -c` (identifier, productName, `build.devUrl`); `-c` can be given more than once and merges in order, after `tauri.dev.conf.json`. Vite reads its port from an env var the script sets (`beforeDevCommand` inherits it). `tauri dev --port` doesn't help: it only sets Tauri's built-in static server. The HMR port (1421) needs nothing: `vite.config.ts` only uses it when `TAURI_DEV_HOST` is set, for mobile; otherwise HMR shares the server port.
- `scripts/app.ts` reads the slot alongside `devConfig()`, so `bun run app` in any checkout finds that checkout's bridge, data and logs. `app status` prints the checkout path, branch and slot.
- The window title shows the slot and branch, e.g. "Astro Editor (Dev 2 · branch-name)". `lib.rs` already sets the dev title at runtime; build it from the product name plus a branch env var the launcher sets (captured at launch).
- List each slot's app data folder in the sandbox `allowRead`/`allowWrite` in `.claude/settings.json`. The docs say globs work, but `is.danny.astroeditor.dev*` only matched the folders themselves, not their contents. `~/Library/Logs` is already readable.
- When setup claims a slot, it empties that slot's app data folder so a reused slot doesn't inherit the last branch's preferences, window state and recovery files. Don't copy slot 0's preferences: agents work in the test vault anyway.
- Update `docs/developer/agent-tooling.md` (dev identity section) and the `app-control` skill.

Why slots rather than an identifier per worktree name: at most four data and log folders in `~/Library`, reused rather than piling up; a bounded set for the sandbox; names and ports that are easy to remember. worktrunk's `hash_port` filter (a stable port per branch) solves only the port, not the identifier.

### Phase 2: setup script

One idempotent `scripts/setup` (name to decide) that any tool can call, and that's safe to rerun:

- `bun install` (cheap: bun copies from its cache with APFS clones)
- `bun run reset:testdata`
- `mkdir -p docs/tasks-todo/temporary`
- claim a dev slot (main checkout always gets 0)
- clone `src-tauri/target/` from the main checkout with `cp -cR` (copy-on-write; skip if it already exists). Don't share one `CARGO_TARGET_DIR`: Cargo's lock serialises builds, and one worktree's rebuild would replace the binary another is running
- copy `.serena/` if still used

`website/` and `telemetry-worker/` installs only when a task needs them. No need to run the dev server to get a build; the first `tauri:dev` does that.

Cloning `target/` is tested: the 31 GB folder cloned into a temporary worktree in 18 s, and `cargo build` there recompiled only the `astro-editor` crate (13 s); a slot-style config overlay (identifier, productName, devUrl via `TAURI_CONFIG`) also recompiled only that crate (5 s). Cargo never hashes absolute paths, so registry dependencies are reused from any path. Clones share disk until files change, but each worktree's rebuilds diverge from there.

Nothing stable cleans `target/` yet, so it grows with every dependency update and so does every clone. A `cargo clean` in the main checkout now and then keeps it in check (it went from 31 GB to 4.4 GB, and the fresh debug build took under a minute). Cargo 1.100 makes the new `build-dir` layout the default, which is groundwork for target-dir garbage collection.

### Phase 3: creating, listing and removing worktrees

Worktrees go next to the repo, not inside it. Claude's `-w` default (`.claude/worktrees/`) would be crawled by the main checkout: Vitest has no exclude for it, so `bun run test:run` would run every worktree's tests, and Vite's watcher would watch their files.

Options:

- **worktrunk (`wt`), recommended to try first.** `brew install worktrunk && wt config shell install`. `wt switch -c <branch> -x claude` creates a worktree at `../astro-editor.<branch>` by default and starts Claude in it. `wt list`, `wt merge` and `wt remove` handle the rest. Project hooks live in a committed `.config/wt.toml` (each needs approving on first run): a blocking `pre-start` hook, which runs on create, calls the setup script. Works the same across all projects. It also has `wt step copy-ignored`, which copies gitignored files from the main checkout with per-file reflinks; the setup script does its own `cp -cR` instead so it doesn't depend on worktrunk.
- **A shell function.** `git worktree add ../astro-editor.<branch> -b <branch> origin/main`, run setup, `cd`, start `claude`. About ten lines, and the fallback if worktrunk doesn't stick.
- **Claude's `claude -w`: not for feature work.** It always creates `.claude/worktrees/<name>/`, which the main checkout's Vitest and Vite would crawl. `worktree.location` only applies to Desktop SSH sessions. The only way to move it is a `WorktreeCreate` hook, which replaces creation entirely, turns off `.worktreeinclude`, and leaves those worktrees out of Claude's sweep. There's no post-create hook to run setup. Keep `-w` and subagent `isolation: worktree` for throwaway agent work.

Whatever creates the worktree, setup runs the same script.

### Starting each worktree's dev app

Danny runs `bun run tauri:dev` by hand in a terminal for each worktree, the same as in the main checkout, so he can see the output and start and stop it. The "never start a dev server" rule stays as it is. No hook starts the dev app. If an agent's `app status` says the app isn't running, it asks Danny to start it in that worktree. (A dev app launched from Claude's sandboxed Bash would inherit the sandbox anyway.)

### Limits

Each running slot is Vite, Cargo's watcher and a debug app with its own webview, and each Rust rebuild links a 650 MB static library. Slots cost nothing while unused, but two or three sessions changing Rust at once will compete for CPU, which caps how many parallel sessions are useful.

### Phase 4: rules and VS Code

Add to `AGENTS.md`:

- You may be in a worktree. Your checkout is `git rev-parse --show-toplevel`. Never read, edit or run commands in the main checkout or other worktrees.
- `bun run app` always talks to this checkout's dev app. Check with `app status`.
- Branch from `origin/main` unless told the work is stacked.
- Never commit to `main` from a worktree.

VS Code (user settings, not the committed `.vscode/settings.json`):

- `git.detectWorktrees: true`, or Source Control only shows worktrees VS Code created
- `window.title` including `${activeRepositoryBranchName}`
- open each worktree with `code <path>` as its own window

Optionally a Claude Code status line showing branch and slot.

### Phase 5: hygiene

- One worktree per PR, removed when it merges: `wt merge`/`wt remove`, or a small script that checks the PR is merged and the worktree is clean, then runs `git worktree remove` and `git worktree prune` (never `rm -rf`).
- Slots cap the leftovers in `~/Library`.
- Claude's periodic sweep (`cleanupPeriodDays`) only covers subagent and background-session worktrees; it skips foreground `-w` sessions and anything made with `git worktree add` or worktrunk.
- Most PRs here are squash-merged, so `git branch --merged` misses them. A branch is safe to delete when its tip is in `main` or equals a merged PR's head (`git ls-remote origin 'refs/pull/*/head'`). `gh stack sync --prune` does this once using stacks.

## Things that already work per worktree

- `docs/tasks-todo/temporary/` and the test vault: `scripts/app.ts` resolves both from its own checkout.
- `CLAUDE.local.md` is gitignored, so each worktree has its own. Its "Current Task" section becomes a per-worktree task pointer.
- Shared across worktrees, as wanted: Claude's auto memory (keyed to the repo, not the folder) and "don't ask again" approvals (saved to the main checkout's `settings.local.json`).

## Later: not part of this task

### Stacked PRs

GitHub stacked PRs became generally available on 6 October 2026 on all github.com plans. Each PR shows only its own layer's diff; when a lower PR merges, the ones above rebase and retarget. CLI: `gh extension install github/gh-stack`, which supports worktrees (one shared stack; `rebase`/`sync` update clean worktrees and skip dirty ones).

Pattern: one worktree per layer, the child branched from the parent branch. With `claude -w` that needs `worktree.baseRef: "head"` launched from the parent worktree; worktrunk takes a base branch directly. Only stack when the later work depends on unmerged code from the earlier one. Smaller layers also keep CodeRabbit reviews focused.

### Other projects

- **Web projects:** derive the port from the checkout and have agent tooling read it from there. portless (`<branch>.<app>.localhost`) is an alternative.
- **Other Tauri apps:** same slots approach.
- **Xcode:** DerivedData is already per path, so worktrees are isolated but each does a cold build. Two worktrees running at once with the same bundle ID replace each other; give the bundle ID a slot suffix through an xcconfig. Consider `-clonedSourcePackagesDirPath` to share SPM checkouts.

## Not verified

- That "don't ask again" approvals from a worktree session are saved to the main checkout's `settings.local.json`.
- Whether `.worktreeinclude` handles whole directories, and whether it copies or clones. Only matters if `claude -w` is used with it.
- The "Redesigning source control at Anthropic" post (13 October 2026) was summarised by a research agent, not read directly. Takeaways if it holds up: few long-lived branches, let Claude resolve conflicts, test after merge.

## Sources

- Claude Code worktrees: https://code.claude.com/docs/en/worktrees
- Claude Code hooks (`WorktreeCreate`, `WorktreeRemove`): https://code.claude.com/docs/en/hooks
- Claude Code settings (`worktree.*`, sandbox path globs): https://code.claude.com/docs/en/settings-reference
- Cargo fingerprints (no absolute paths): `src/cargo/core/compiler/fingerprint/mod.rs` in rust-lang/cargo
- Cargo changelog (`build-dir`, GC status): https://doc.rust-lang.org/nightly/cargo/CHANGELOG.html
- VS Code branches and worktrees: https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees
- GitHub stacked PRs: https://docs.github.com/en/pull-requests/reference/stacked-pull-requests and https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands
- worktrunk: https://worktrunk.dev
- Tauri CLI (`-c` overlays): https://v2.tauri.app/reference/cli/
- Single-instance plugin, macOS socket: https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/single-instance/src/platform_impl/macos.rs
- Anthropic, Redesigning source control: https://www.anthropic.com/engineering/redesigning-source-control
