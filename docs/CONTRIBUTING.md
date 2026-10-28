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
bun install
bun run reset:testdata  # creates temp-dummy-astro-project, a test Astro project
bun run tauri:dev       # runs the app
```

Open `temp-dummy-astro-project` in the app to try things out.

## Making changes

- Read the Rules and Where things live sections of `AGENTS.md` at the repo root (the rest is for AI agents), then `docs/developer/architecture-guide.md` and the doc for the area you're changing. The rules apply to human contributors too.
- Add tests for logic in `lib/` and for anything that's easy to break.
- If your change adds a pattern or makes a doc wrong, update `docs/developer/`.
- Run `bun run check:all` before opening a pull request, and fix anything it reports (`bun run fix:all` handles formatting and simple lint fixes).

## Pull requests

Branch from `main`, keep each pull request to one change, and describe the problem it solves before how it solves it. CI only runs on pull requests with the `ci` label, which a maintainer adds, so run `check:all` locally first.

## Licence

By contributing, you agree that your contributions will be licensed under the project's licence (AGPL-3.0-or-later).
