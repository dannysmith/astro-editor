# Task: Release Hosting Rework (stop committing binaries + checksums)

**This is PR A — do it before the Linux deb/rpm work (`task-2-linux-deb-rpm-packaging.md`).** It touches only the formats we already ship (macOS dmg, Windows msi, Linux AppImage), so the structural change is de-risked on known-good artifacts before new package formats arrive.

## Overview

Today the release pipeline commits installer binaries into the repo and serves them from GitHub Pages. `publish-website-artifacts.yml` downloads the DMG/MSI/AppImage from a published Release, copies them into `website/` with `*-latest.*` names, and commits them to `main`; `deploy-website.yml` then publishes `website/` to Pages. This has bloated `.git` to ~650 MB (almost entirely ~80 MB AppImage revisions × ~11 releases) and grows on every release.

This task removes binaries from the repo entirely and serves downloads straight from GitHub Releases via stable, permanent URLs, and adds checksums while we're in here.

## Background and key facts

- **Git LFS is the wrong tool here.** GitHub Pages does not resolve LFS pointers — it serves the ~130-byte pointer file, which would break every download link on the site. The root fix is to stop committing binaries at all, not to relocate them to LFS.
- GitHub Releases already host every installer permanently. The blocker for linking to them is that Tauri asset names are versioned (`Astro.Editor_1.0.12_amd64.AppImage`), so a static site can't hard-code them. Fix: publish **stable-named copies** to each Release so the site can link to `https://github.com/dannysmith/astro-editor/releases/latest/download/<stable-name>`. This mirrors how the updater already consumes `/releases/latest/download/latest.json`.
- A future Starlight rebuild of the website will have a build step that can read `latest.json`/the GitHub Release directly, making stable names redundant — so this approach doesn't paint us into a corner.

## Decisions (settled)

- Serve downloads from GitHub Releases using **stable-named asset uploads**. Accept the minor asset duplication (versioned + stable copy on each release).
- Generate a single **`SHA256SUMS`** file per release (computed on the Linux runner over all assets), uploaded as a release asset.
- **Do not** use Git LFS.
- **Do not** rewrite git history to purge the existing ~600 MB. Research showed it likely won't reclaim GitHub-side space while active forks reference the blobs (GitHub dedups across the fork network and won't run a network GC for non-sensitive data), and it diverges every active fork. Stopping new commits is the worthwhile part; anyone wanting a small clone can use `git clone --filter=blob:none`. (Removing the binaries from the working tree does not shrink history — that's expected and fine.)

## Files in scope

- `.github/workflows/release.yml` — add a post-build step/job to publish stable-named assets + `SHA256SUMS` to the draft Release.
- `.github/workflows/publish-website-artifacts.yml` — retire (or strip to nothing that commits binaries).
- `.github/workflows/deploy-website.yml` — verify it still triggers correctly when `website/**` source changes; it no longer needs to run after every release.
- `website/index.html` — change the three download `href`s (currently `./astro-editor-latest.*`) to `/releases/latest/download/...` URLs.
- `website/astro-editor-latest.{dmg,msi,AppImage}` — remove from the working tree; add a `.gitignore` rule so they can't be re-added.
- `docs/developer/releases.md` — update the architecture/flow sections to match.

## Phased approach

### Phase 1 — Publish stable-named assets + checksums to the Release

Add a job to `release.yml` (e.g. `needs: publish-tauri`, runs on `ubuntu-latest`) that:

1. Downloads the just-built assets from the draft Release for the tag (`gh release download "$TAG"` for the dmg/msi/AppImage patterns).
2. Creates stable-named copies: `astro-editor-latest.dmg`, `astro-editor-latest.msi`, `astro-editor-latest.AppImage`.
3. Generates `SHA256SUMS` over the real (versioned) assets with `sha256sum`.
4. Uploads the stable-named copies and `SHA256SUMS` back to the same draft Release with `gh release upload "$TAG" ... --clobber`.

Notes / gotchas:
- The Release is a **draft** at this point; `gh release download`/`upload` work against drafts with `contents: write`.
- `--clobber` lets re-runs overwrite cleanly.
- Keep this job generic so `task-2` can extend it with deb/rpm by adding patterns/names in one place.

### Phase 2 — Point the website at GitHub Releases

1. Update the three `href`s in `website/index.html` to `https://github.com/dannysmith/astro-editor/releases/latest/download/astro-editor-latest.{dmg,msi,AppImage}`.
2. Confirm `/releases/latest/download/<stable-name>` resolves (302 → `objects.githubusercontent.com`) — fine for a plain download link.

### Phase 3 — One-time backfill for the current release

The stable-named assets only get created from the next tagged release onward. So the site's new links would 404 until then. Backfill once so links work immediately on merge:

- Run the Phase 1 logic against the current latest release (`v1.0.12`) — either via a `workflow_dispatch` path on the new job or by manually `gh release upload v1.0.12 astro-editor-latest.* SHA256SUMS --clobber` from a local download. Document whichever we choose.

### Phase 4 — Stop committing binaries and retire the website-artifacts workflow

1. `git rm` the three `website/astro-editor-latest.*` binaries from the working tree.
2. Add them to `.gitignore` (e.g. `website/astro-editor-latest.*`).
3. Retire `publish-website-artifacts.yml` (delete it, or reduce it so it no longer downloads/copies/commits binaries). Remove its `gh workflow run deploy-website.yml` trigger if it no longer does anything useful.
4. Confirm `deploy-website.yml` still deploys correctly on genuine `website/**` source changes and that Pages serves the site without the binaries present.

### Phase 5 — Docs

Update `docs/developer/releases.md`: the flow diagram, the `publish-website-artifacts.yml` section, and the "Auto-Update System" notes to reflect that downloads come from Release assets via stable URLs, binaries are no longer committed, and a `SHA256SUMS` file is published.

## Out of scope

- Linux deb/rpm packaging — that's `task-2`.
- Git history purge of the existing ~600 MB — explicitly **not doing** this now (see Decisions). May be revisited in the distant future as its own task.
- Any change to the updater/`latest.json` mechanism (untouched here).

## Testing

- Everything here is exercisable without a Linux machine.
- Validate Phase 1 by inspecting a draft Release (push a throwaway tag, or use the current release for the backfill path) and confirming the stable-named assets + `SHA256SUMS` appear and download.
- Verify `sha256sum -c SHA256SUMS` passes against the downloaded assets.
- After Phase 2/3, click each download button on the deployed (or locally served) site and confirm it fetches the correct installer.
- After Phase 4, confirm a website-source change still deploys via `deploy-website.yml` and the live site has no committed binaries.

## Success criteria

1. No installer binaries are committed to the repo on release; `.git` stops growing per release.
2. The website's three download buttons serve the latest installers from GitHub Releases via stable URLs.
3. Each release carries a `SHA256SUMS` asset that verifies against the installers.
4. `publish-website-artifacts.yml`'s commit-to-main behaviour is gone; `deploy-website.yml` still works for genuine site changes.
5. `docs/developer/releases.md` matches the new flow.
