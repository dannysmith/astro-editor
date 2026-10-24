---
name: deps-update
description: Run an interactive dependency update session across the whole repo (main app JS + Rust, test fixtures, telemetry worker, CI), tracked in a task doc so it can resume across sessions. Use when the user asks to update dependencies, review Dependabot PRs, or revisit held/pinned packages.
---

# Dependency Update Session

Covers everything in the repo that has dependencies: the main app (JS and Cargo), the Astro fixtures in `test/`, `telemetry-worker/`, and GitHub Actions. `website/` is a separate project with its own AGENTS.md; include it only if the user asks.

Use the package manager named in the root `package.json` `packageManager` field.

## State lives in a task doc

The session runs across several contexts, so all state goes in `docs/tasks-todo/task-x-dependency-updates-YYYY-MM.md`.

- If one exists, read it and resume where it left off.
- Otherwise create it after research: status and branch, research findings, a phase checklist, a holds table (package, current, latest, why held), a decisions log and an issues log.
- Update it at every checkpoint, so the user can clear context and run this skill again.

Work on a `deps-YYYY-MM-DD` branch; confirm the name with the user before creating it.

## Research first

- **Last time:** read the most recent `docs/tasks-done/*dependency-updates*` doc. Its holds table and follow-ups are the starting point: re-check each hold and say whether it still applies.
- **Dependabot:** list the open Dependabot PRs. They are closed as superseded after merge. Note any GitHub Actions bumps; those get applied to the workflows.
- **Outdated packages:** check JS and Cargo (`cargo update --dry-run` if `cargo-outdated` isn't installed), the fixtures and the worker.
- **Major bumps:** read the changelog for each, check whether it affects our usage by reading our code, and use Context7 before web search.
- **Constraints:** read the documented ones in AGENTS.md and the dev docs. Know why each override and exact pin exists before touching it.

**Checkpoint:** present the findings and the decisions needed. Ask before proceeding.

## Phases

One commit (or a small group) per phase. Run `check:all` after each.

1. **Hotfixes**: anything already broken on `main` or live for users goes first, so it can be cherry-picked into a patch release if the rest drags
2. **Main app JS**: minor/patch within ranges, then majors one at a time
3. **Rust**: `cargo update`, then major bumps. Keep every `@tauri-apps/*` JS package on the same major.minor as its Rust crate
4. **Fixtures**: upgrade Astro (`@astrojs/upgrade`), run `astro sync`, commit the regenerated `.astro/collections/*.schema.json` (Rust tests depend on them), then `reset:testdata`
5. **Telemetry worker**: update deps, `wrangler deploy --dry-run`. The user deploys to staging and runs `./stats.sh` (needs Cloudflare auth)
6. **CI and scripts**: apply the Actions bumps from Dependabot and check that `scripts/` and the workflows still work with the new tools

## Known hazards

- **`@lezer/*` and `@codemirror/*` versions**: there must be exactly one copy of each in the tree. Mismatches silently break syntax highlighting (or typecheck, for `@codemirror/view`). In-range updates can leave older copies nested under other packages, which a top-level version check misses. Look for nested lockfile entries (see AGENTS.md) after every JS update, and regenerate the lockfile if there are any
- **Peer auto-installs**: package managers install peers automatically and pick the newest version in the peer range, so a minor bump can silently pull in a major (this is how Babel 8 nearly arrived under the React Compiler). Scan the update output for major jumps in packages that aren't direct dependencies
- **tauri-specta**: regenerates `src/lib/bindings.ts` in debug builds. Diff it after any specta or Rust model change
- **Release pipeline**: changes to `release.yml` or tauri-action can't be fully tested by PR CI, since release only runs on tags. Plan how to verify them or split them into their own task
- **Bundle size**: note significant increases (the visualizer writes `bundle-stats.html` on build)

## Finish

- `check:all`, then a production build (`tauri build --bundles app --no-sign --config '{"bundle":{"createUpdaterArtifacts":false}}'`), checking for new warnings
- Run a security audit and note anything fixable in the task doc
- Remove comments and docs about constraints that no longer apply
- Ask the user for a smoke test. Suggest specific checks for whatever changed (CodeMirror → highlighting and editing; clipboard plugin → copy/paste; and so on)
- The user pushes and opens the PR (with the `ci` label so the build matrix runs). Merge with a **merge commit**, not a squash, so phases stay bisectable
- After merge: close superseded Dependabot PRs and move the task doc to `docs/tasks-done/`
