---
allowed-tools: [Read, Bash, Glob, Grep, Edit, Write, WebSearch, WebFetch, AskUserQuestion, mcp__context7__resolve-library-id, mcp__context7__query-docs]
description: 'Interactive dependency update session with state tracking'
---

# /deps-update - Dependency Update Session

## Purpose

Guide an interactive dependency update session across the entire project: main Tauri app (npm + Cargo), test Astro sites, and telemetry worker. Uses a task document to track state, enabling resume across sessions if context runs low.

## Initial Checks

### 1. Check for Existing Task Document

Look for an existing dependency update task in `tasks-todo/`:

```bash
ls tasks-todo/ | grep -i dep
```

**If found:** Read the task document and resume from where it left off. The task doc contains:
- Research findings
- Phase completion status
- Any in-progress work or decisions made

**If not found:** Proceed to Research Phase to create one.

### 2. Verify Branch

```bash
git branch --show-current
```

**If on `main`:** Ask user to create a deps branch:
```
Suggested branch name: deps-YYYY-MM-DD (today's date)
```

Use AskUserQuestion to confirm branch name before creating.

**If on a `deps-*` branch:** Proceed.

## Research Phase

Gather information before making changes. Document findings in the task doc.

### 1. Check Dependabot PRs

```bash
gh pr list --author "app/dependabot" --state open
```

This shows grouped PRs (development-dependencies, production-dependencies, rust-dependencies) plus individual package PRs. Note:
- Any that relate to known pinned packages
- Any GitHub Actions PRs (branches like `dependabot/github_actions/...`) - these need to be applied to workflow files during Finalization

All these PRs should auto-close when our deps PR merges, since we'll have addressed the same updates.

### 2. Check Previous Dependency Updates

Read the most recent dependency update task from `tasks-done/` for context on:
- Previously deferred upgrades and why
- Known compatibility issues
- Patterns that worked well

```bash
ls -t tasks-done/ | grep -i dep | head -3
```

### 3. Check Outdated Packages

**npm:**
```bash
pnpm outdated
```

**Cargo** (requires `cargo-outdated` - install with `cargo install cargo-outdated` if missing):
```bash
cd src-tauri && cargo outdated
```

If cargo-outdated isn't installed, use:
```bash
cd src-tauri && cargo update --dry-run
```

### 4. Review Internal Documentation

Check for documented version constraints and/or pinned packages to research. Eg.

1. **AGENTS.md** - Eg may mention `@lezer/*` version compatibility, pinning of certain crates
2. **docs/developer/editor.md** - Eg. may mention lezer/highlight behavior notes
3. **Previous task docs** - deferred upgrades and reasons
4. **PNPM Overrides** - Check `package.json` for any overrides and work out why they're there.

### 5. Create Task Document

Create `tasks-todo/task-x-dependency-updates-YYYY-MM.md` with:

```markdown
# Dependency Updates - [Month Year]

## Status

**Current Phase:** Research
**Branch:** deps-YYYY-MM-DD

## Research Findings

### Dependabot PRs
[List open PRs]

### Outdated Packages Summary
[Key outdated packages, especially major version bumps]

### Pinned Package Status
| Package   | Current   | Latest | Decision | Notes            |
| --------- | --------- | ------ | -------- | ---------------- |
| [package] | [version] | ?      | Pending  | [reason for pin] |
| ...       |           |        |          |                  |

### Previous Upgrade Context
[RELEVANT notes from last upgrade task]

---

## Phase Checklist

### Main App
- [ ] npm dependencies (non-pinned)
- [ ] Cargo dependencies (non-pinned)
- [ ] Review pinned packages
- [ ] Run check:all
- [ ] Production build + inspect warnings

### Test Sites
- [ ] demo-project (upgrade Astro, update deps, review pins, verify works)
- [ ] dummy-astro-project
- [ ] starlight-minimal
- [ ] Run reset:testdata

### Telemetry Worker
- [ ] Update dependencies
- [ ] Review pinned packages
- [ ] Test staging deployment
- [ ] Verify stats.sh works

### Finalization
- [ ] Check .github/workflows compatibility
- [ ] Check scripts/ compatibility
- [ ] Run check:all
- [ ] Update docs (remove obsolete override notes)
- [ ] Manual smoke test (user)
- [ ] Push + create PR (user)
- [ ] Merge + verify CI (user)
- [ ] Verify dependabot issues auto-close (user)

---

## Decisions Log

[Record decisions about pinned packages, deferred upgrades, etc.]

## Issues Encountered

[Document any regressions, fixes applied, etc.]
```

## Main App Phase

### 1. Review Research Findings

Before updating, review what `pnpm outdated` and `cargo outdated` found in Research Phase. Identify any packages that:
- Have major version bumps (may have breaking changes)
- Were flagged as problematic in previous upgrade tasks
- Are related to pinned packages

Discuss any concerns with user before proceeding.

### 2. Update npm Dependencies

```bash
pnpm update
```

Review what changed. For any major version bumps, briefly check changelogs.

### 3. Update Cargo Dependencies

```bash
cd src-tauri && cargo update
```

### 4. Review Pinned Packages (Interactive)

Review pinned packages in both `package.json` (npm) and `Cargo.toml` (Rust). Look for exact versions (`=1.2.3` in Cargo, no `^`/`~` in npm) and pnpm overrides.

For each pinned package, use AskUserQuestion:

**Example:**
```
[package] is pinned to [version] ([reason for pin])

Options:
1. Research update - Check if update is now safe
2. Keep pinned - Issue persists, defer to next session
3. Skip for now - Decide later
```

If user chooses "Research update":
- Check crates.io / npm for latest version
- Check release notes for breaking changes
- Use Context7 or WebSearch if needed
- Present findings and ask for decision

### 5. Run Checks

```bash
pnpm run check:all
```

Fix any errors. Common issues after updates:
- Type errors from changed APIs
- Deprecated function warnings
- Test failures

### 6. Production Build

```bash
pnpm run tauri:build
```

Inspect logs for:
- Deprecation warnings
- Build warnings that could become errors

**Update task doc** and suggest user commits if everything passes. This creates a checkpoint before moving to test sites.

## Test Sites Phase

For each site in `test/`:

### 1. Upgrade Astro

First, check what would be upgraded:
```bash
cd test/[site] && pnpm dlx @astrojs/upgrade --dry-run
```

If dry-run shows a clean upgrade path (no conflicts or breaking changes), run the actual upgrade:
```bash
cd test/[site] && pnpm dlx @astrojs/upgrade
```

The tool typically runs non-interactively. If it does prompt for input (e.g., breaking changes requiring decisions), ask the user to run it manually and report back.

### 2. Update Other Dependencies

```bash
cd test/[site] && pnpm update
```

### 3. Review Pinned Packages

Check `package.json` for any exact pins (versions without `^` or `~`). Run `pnpm outdated` to see if pinned packages have updates available. If any exist, take same approach as Main App Phase step 4.

### 4. Verify Site Works (User Action Required)

Ask user to:
1. Run `pnpm run dev` in the test site
2. Check the site builds and renders correctly in browser
3. Open the project in Astro Editor and verify collections load and frontmatter forms work

Use AskUserQuestion to confirm site works.

**Note:** Astro generates `.astro/` schemas - remind user these should be included when they commit.

### 5. After dummy-astro-project

Run reset:testdata to update the temp copy used for testing:
```bash
pnpm run reset:testdata
```

**Update task doc** and suggest user commits after all test sites are verified working.

## Telemetry Worker Phase

### 1. Update Dependencies

```bash
cd telemetry-worker && pnpm update
```

Check for wrangler major version changes - these may have API/config changes.

### 2. Review Pinned Packages

Check `package.json` for any exact pins (versions without `^` or `~`). Run `pnpm outdated` to see if pinned packages have updates available. If any exist, take same approach as Main App Phase step 4.

### 3. Test Staging Deployment

First verify config is valid:
```bash
cd telemetry-worker && wrangler deploy --dry-run
```

If dry-run passes, deploy to staging to verify it actually works:
```bash
cd telemetry-worker && pnpm run deploy:staging
```

If either fails, check:
- `wrangler.toml` for deprecated config
- `worker.js` for deprecated APIs
- README.md for outdated instructions

### 4. Verify Stats Script

```bash
cd telemetry-worker && ./stats.sh
```

Confirm it still queries the database correctly.

### 5. Update README if Needed

If wrangler had significant changes, update `telemetry-worker/README.md`.

**Update task doc** and suggest user commits after telemetry worker is verified.

## Finalization Phase

### 1. Apply GitHub Actions Updates

Check the dependabot PRs from Research Phase for any GitHub Actions updates (branches like `dependabot/github_actions/...`). Apply those version bumps to `.github/workflows/*.yml`.

Also review workflows for:
- Commands that may have changed due to tool updates
- Node/Rust version compatibility

### 2. Check Scripts

Review `scripts/*.js` for compatibility with updated packages.

### 3. Final Check

```bash
pnpm run check:all
```

### 4. Security Audit (Informational)

Run security audits for awareness:
```bash
pnpm audit
cd src-tauri && cargo audit
```

Note any issues in the task doc. Some may be unfixable due to transitive dependencies - that's expected. Only flag critical issues that have available fixes.

### 5. Clean Up Documentation

If any pnpm overrides or version pins were removed because issues were fixed upstream:
- Remove related comments from `package.json`
- Update `AGENTS.md` if it mentions the constraint
- Check `docs/developer/*.md` for outdated version notes

### 6. Manual Smoke Test

Ask user to perform manual smoke test of Astro Editor. If there have been major updates or breaking changes to dependencies, suggest specific smoke tests related to them if it makes sense (Eg. if we have updated CodeMirror, suggest some targetted editor-focussed smoke tests; if we updated tauri-plugin-clipboard-manager then strongly suggest some tests of clipboard-related features etc.)

Use AskUserQuestion to confirm smoke test passed.

### 7. Push and Create PR

```bash
git add -A
git commit -m "chore(deps): [month] dependency updates"
git push -u origin [branch-name]
gh pr create --title "chore(deps): [Month] dependency updates" --body "## Summary
- Updated npm dependencies
- Updated Cargo dependencies
- Updated test Astro sites to Astro X.X
- Updated telemetry worker

## Pinned Package Decisions
[Summary of decisions]"
```

### 8. Post-Merge (Manual steps by user)

After PR is merged:
1. Verify CI passes on main
2. Check dependabot PRs/issues auto-close
3. Move task doc to `tasks-done/` with completion date

## Context Management

1. **Update the task doc at appropriate points** with current state:
   - Mark completed items
   - Note any in-progress work
   - Record decisions made
   - Document any issues encountered

2. **Commit work so far** (if substantive changes made)

3. **User can clear context** and run `/deps-update` again - the command will detect the existing task doc and resume.

## Intelligence Guidelines

### When to Research vs. Skip

**Research a pinned package if:**
- It's been 2+ months since last check
- User reports issues related to it
- Dependabot suggests an update for it

**Skip/defer if:**
- Stable version still not released
- Known compatibility issues persist

### Breaking Change Handling

When a package has breaking changes:
1. Check if it affects our usage (read our code that uses it)
2. Check Context7 or official docs for migration guide
3. Estimate effort and ask user whether to:
   - Update now and migrate
   - Defer to dedicated task
   - Keep current version

### Regression Detection

After updates, watch for:
- Syntax highlighting changes (lezer packages can be an issue)
- Significant build size increases (check bundle analyzer)
- Type errors in IDE (user can report)
- Test failures
- Runtime console errors

Document any regressions in the task doc with root cause and fix.

## Output

Throughout the session, provide clear status updates:

```
## Progress Update

### Completed
- [x] Research phase
- [x] npm updates (32 packages)
- [x] Cargo updates (47 crates)

### Current
- Reviewing pinned packages (2/4 done)

### Remaining
- Test sites (0/3)
- Telemetry worker
- Finalization

### Decisions Made
- specta: Keep pinned (still RC)
- react-resizable-panels: Keep at 3.x (shadcn compatibility)
```

## After Session

If all phases complete successfully:

1. Ensure task doc is fully updated with:
   - All decisions made
   - Any issues encountered and fixes
   - Notes for next time

2. Move to tasks-done:
```bash
pnpm task:complete dependency-updates
```
