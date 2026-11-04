# Contributing to Astro Editor

Bug reports, feature requests and pull requests are welcome. Before building a feature, check it fits the [product philosophy](https://astroeditor.danny.is/getting-started/philosophy/): Astro Editor is for writing and editing, and leaves code, git and publishing to other tools. Opening an issue first is the best way to check.

## Setup

You'll need:

- macOS (the supported platform; Windows and Linux builds work but aren't officially supported)
- [bun](https://bun.sh)
- Node.js (current LTS), which Vitest and the Tauri CLI run on
- Rust (current stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

Then:

```bash
bun run setup      # installs dependencies and creates temp-dummy-astro-project, a test Astro project
bun run tauri:dev  # runs the app
```

Open `temp-dummy-astro-project` in the app to try things out. `bun run reset:testdata` puts it back as it was.

## Working on several things at once

Each git worktree of the repo runs its own dev app alongside the others, with its own app data, logs and port. The easiest way to manage them is [worktrunk](https://worktrunk.dev) (`brew install worktrunk && wt config shell install`):

```bash
wt switch -c my-branch -x claude  # new worktree at ../astro-editor.my-branch, set up, with Claude started in it
cd ../astro-editor.my-branch && bun run tauri:dev # in another terminal in that worktree: opens "Astro Editor Dev 1" (or 2–4)
code ../astro-editor.my-branch    # its own VS Code window

wt list                           # all worktrees
wt switch my-branch               # go back to one
wt remove my-branch               # when its PR has merged: delete the worktree and branch, freeing its dev slot
```

Without worktrunk, `git worktree add ../astro-editor.my-branch -b my-branch origin/main`, then run `bun run setup` in the new folder. Keep worktrees next to the repo, not inside it. Up to four worktrees can have dev slots at once, and `bun run app status` shows which slot a checkout has. See "Worktrees and dev slots" in `docs/developer/agent-tooling.md`.

## Making changes

- Read the Rules and Where things live sections of `AGENTS.md` at the repo root (the rest is for AI agents), then `docs/developer/architecture-guide.md` and the doc for the area you're changing. The rules apply to human contributors too.
- Add tests for logic in `lib/` and for anything that's easy to break.
- If your change adds a pattern or makes a doc wrong, update `docs/developer/`.
- Run `bun run check:all` before opening a pull request, and fix anything it reports (`bun run fix:all` handles formatting and simple lint fixes).

## Pull requests

Branch from `main`, keep each pull request to one change, and describe the problem it solves before how it solves it. CI only runs on pull requests with the `ci` label, which a maintainer adds, so run `check:all` locally first.

## Licence

By contributing, you agree that your contributions will be licensed under the project's licence (AGPL-3.0-or-later).
