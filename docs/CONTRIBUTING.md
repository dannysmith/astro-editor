# Contributing to Astro Editor

Bug reports, feature requests and pull requests are welcome. Before building a feature, check it fits the [product philosophy](https://astroeditor.danny.is/getting-started/philosophy/): Astro Editor is for writing and editing, and leaves code, git and publishing to other tools. Opening an issue first is the best way to check.

## Setup

You'll need:

- macOS (the supported platform; Windows and Linux builds work but aren't supported yet)
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

## Making Changes

- Read `AGENTS.md` at the repo root. Despite the name it's the entry point for everyone: the rules, where things live, the commands and the developer docs. Then read `docs/developer/architecture-guide.md` and the doc for the area you're changing.
- Follow the patterns in the surrounding code.
- Add tests for logic in `lib/` and for anything that's easy to break.
- If your change adds a pattern or makes a doc wrong, update `docs/developer/`.
- Run `bun run check:all` before opening a pull request, and fix anything it reports (`bun run fix:all` handles formatting and simple lint fixes).

## Pull Requests

Branch from `main`, keep each pull request to one change, and describe the problem it solves before how it solves it. CI runs the full check and a build on pull requests labelled `ci`.

## License

By contributing, you agree that your contributions will be licensed under the project's license (AGPL-3.0-or-later).
