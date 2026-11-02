# Parallel worktrees

## Problem

Danny works in one checkout of this repo: Claude Code and `bun run tauri:dev` in one terminal, VS Code alongside. He wants several features in progress at once, each with its own Claude session, dev app and VS Code window, without them interfering. Git worktrees are the obvious tool, but today a second `tauri:dev` can't run at all, and nothing sets up a new checkout.

The aim is for each checkout to identify itself: the dev launcher and `bun run app` work out which dev app is theirs from the checkout they run in. Then it doesn't matter what created the worktree (Claude, worktrunk, VS Code, the desktop app), and Claude needs no extra instructions to find its own app.

The same pattern should carry over to Danny's other Tauri, web and Xcode projects, so keep the approach generic where it costs nothing.

## What blocks a second dev app today

- **Vite port:** `vite.config.ts` uses port 1420 with `strictPort`, and `src-tauri/tauri.conf.json` hardcodes `devUrl: http://localhost:1420`. A second instance fails immediately.
- **Single-instance plugin:** `src-tauri/src/lib.rs` registers it on every desktop platform. On macOS it uses a socket named after the identifier (`/tmp/<identifier>_si.sock`), so a second dev app with the same identifier hands off to the first and quits. The comment there ("macOS is already single-instance") only holds for apps launched from Finder; `tauri dev` runs the binary directly.
- **Everything keyed by `is.danny.astroeditor.dev`:**
  - app data, preferences and window state are shared, so instances clobber each other
  - `tauri-dev.log` is replaced by whichever instance started last
  - `agent-bridge.json`: the last instance to start wins, and when either quits it deletes the file the other wrote, so `bun run app` drives the wrong app or none
  - the window title is hardcoded to "Astro Editor (Dev)"
- **Cargo `target/` is 18 GB.** A new worktree starts empty, so its first build is a full rebuild.

The agent bridge's own port is fine: it falls back to a random free port.

## Plan

### Phase 1: dev slots

The main checkout keeps today's identity (slot 0). Each worktree claims the lowest free slot from 1 to 4 during setup and stores it in a gitignored file in the worktree. A slot sets:

| Slot | Identifier                    | Product name       | Vite port  |
| ---- | ----------------------------- | ------------------ | ---------- |
| 0    | `is.danny.astroeditor.dev`    | Astro Editor Dev   | 1420       |
| n    | `is.danny.astroeditor.dev<n>` | Astro Editor Dev n | 1420 + 10n |

- `scripts/tauri-dev.sh` reads the slot and passes an inline overlay with `tauri dev -c` (identifier, productName, `build.devUrl`). Vite reads its port from an env var the script sets. Check the HMR port (1421) too.
- `scripts/app.ts` reads the slot alongside `devConfig()`, so `bun run app` in any checkout finds that checkout's bridge, data and logs. `app status` prints the checkout path, branch and slot.
- The window title shows the slot and branch, e.g. "Astro Editor (Dev 2 · branch-name)".
- Add the slot identifiers to the sandbox `allowRead`/`allowWrite` in `.claude/settings.json` (and Danny's global sandbox list). A fixed list avoids needing glob support, which is unverified.
- Each slot's dev app starts with empty preferences. Decide whether setup copies slot 0's preferences.
- Update `docs/developer/agent-tooling.md` (dev identity section) and the `app-control` skill.

Why slots rather than an identifier per worktree name: at most four data and log folders in `~/Library`, reused rather than piling up; a fixed list for the sandbox; names and ports that are easy to remember.

### Phase 2: setup script

One idempotent `scripts/setup` (name to decide) that any tool can call, and that's safe to rerun:

- `bun install` (cheap: bun copies from its cache with APFS clones)
- `bun run reset:testdata`
- `mkdir -p docs/tasks-todo/temporary`
- claim a dev slot (main checkout always gets 0)
- clone `src-tauri/target/` from the main checkout with `cp -cR` (copy-on-write). Test whether Cargo reuses most of it from a different path. If not, try `RUSTC_WRAPPER=sccache`. Don't share one `CARGO_TARGET_DIR`: Cargo's lock serialises builds, and one worktree's rebuild would replace the binary another is running
- copy `.serena/` if still used

`website/` and `telemetry-worker/` installs only when a task needs them. No need to run the dev server to get a build; the first `tauri:dev` does that.

### Phase 3: creating, listing and removing worktrees

Worktrees go next to the repo, not inside it. Claude's `-w` default (`.claude/worktrees/`) would be crawled by the main checkout: Vitest has no exclude for it, so `bun run test:run` would run every worktree's tests, and Vite's watcher would watch their files.

Options:

- **worktrunk (`wt`), recommended to try first.** `wt switch -c <branch> -x claude` creates a sibling worktree and starts Claude in it. `wt list`, `wt merge` and `wt remove` handle the rest. Project hooks in a committed `.config/wt.toml` can call the setup script. Works the same across all projects.
- **Claude's `claude -w`.** Zero extra tools and an exit prompt that cleans up, but it needs excludes for `.claude/worktrees/` in Vitest and Vite (and the same in every project). A `WorktreeCreate` hook can move the location, but then `.worktreeinclude` stops working and Claude's sweep skips those worktrees. Keep `-w` and subagent `isolation: worktree` for throwaway agent work either way.

Either way, setup runs the same script.

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
- Claude's periodic sweep (`cleanupPeriodDays`) only covers worktrees Claude created.
- There are about 70 local branches already. Prune merged ones (`git branch --merged`, or `gh stack sync --prune` once using stacks).

## Things that already work per worktree

- `docs/tasks-todo/temporary/` and the test vault: `scripts/app.ts` resolves both from its own checkout.
- `CLAUDE.local.md` is gitignored, so each worktree has its own. Its "Current Task" section becomes a per-worktree task pointer.
- Shared across worktrees, as wanted: Claude's auto memory (keyed to the repo, not the folder) and "don't ask again" approvals (saved to the main checkout's `settings.local.json`).

## Stacked PRs

GitHub stacked PRs became generally available on 6 October 2026 on all github.com plans. Each PR shows only its own layer's diff; when a lower PR merges, the ones above rebase and retarget. CLI: `gh extension install github/gh-stack`, which supports worktrees (one shared stack; `rebase`/`sync` update clean worktrees and skip dirty ones).

Pattern: one worktree per layer, the child branched from the parent branch. With `claude -w` that needs `worktree.baseRef: "head"` launched from the parent worktree; worktrunk takes a base branch directly. Only stack when the later work depends on unmerged code from the earlier one. Smaller layers also keep CodeRabbit reviews focused.

## Other projects

- **Web projects:** derive the port from the checkout and have agent tooling read it from there. portless (`<branch>.<app>.localhost`) is an alternative.
- **Other Tauri apps:** same slots approach.
- **Xcode:** DerivedData is already per path, so worktrees are isolated but each does a cold build. Two worktrees running at once with the same bundle ID replace each other; give the bundle ID a slot suffix through an xcconfig. Consider `-clonedSourcePackagesDirPath` to share SPM checkouts.

## Not verified

- Whether a cloned `target/` lets Cargo reuse most of the build from a new path.
- Whether the sandbox config accepts globs.
- `worktree.symlinkDirectories` and `worktree.sparsePaths` appear in Claude Code's settings index, but their details weren't readable.
- The "Redesigning source control at Anthropic" post (13 October 2026) was summarised by a research agent, not read directly. Takeaways if it holds up: few long-lived branches, let Claude resolve conflicts, test after merge.

## Sources

- Claude Code worktrees: https://code.claude.com/docs/en/worktrees
- Claude Code hooks (`WorktreeCreate`, `WorktreeRemove`): https://code.claude.com/docs/en/hooks
- VS Code branches and worktrees: https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees
- GitHub stacked PRs: https://docs.github.com/en/pull-requests/reference/stacked-pull-requests and https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands
- worktrunk: https://worktrunk.dev
- Tauri CLI (`-c` overlays): https://v2.tauri.app/reference/cli/
- Single-instance plugin, macOS socket: https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/single-instance/src/platform_impl/macos.rs
- Anthropic, Redesigning source control: https://www.anthropic.com/engineering/redesigning-source-control
