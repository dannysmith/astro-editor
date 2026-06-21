# Task: Linux deb/rpm Packaging + Auto-Update

**This is PR B — do it after the release hosting rework (`task-1-release-hosting-rework.md`).** Phase 1 below is a verification spike that gates the rest; do not wire up website/docs until it passes.

## Overview

Build `.deb` and `.rpm` packages alongside the existing AppImage, publish them on GitHub Releases, enable in-app auto-update for them, and signpost them on the website as beta. Supersedes PR #201 (which is a one-line proof of concept) — keep #201 open as reference and close it when this lands.

## Background and key facts (from research)

- **deb/rpm auto-update works on this project's current versions.** `tauri-plugin-updater` 2.10.1, `tauri` 2.11.2, and `tauri-action` 0.6.2 are all at or above the versions that introduced multi-format Linux updater support (plugin ≥ 2.10.0, tauri-action ≥ 0.5.24). No dependency upgrade is needed.
- **`latest.json` has no key conflict.** Tauri emits both a generic `linux-x86_64` key and format-specific keys (`linux-x86_64-appimage`, `-deb`, `-rpm`). At runtime the updater tries the format-specific key first, then the generic one. So building all three formats produces three non-conflicting entries; the generic key being "last-writer-wins" is harmless because clients (plugin ≥ 2.10.0) use the specific key. The current AppImage-only `latest.json` already shows both `linux-x86_64` and `linux-x86_64-appimage` keys.
- **Update mechanism differs by format.** AppImage self-replaces its binary silently. **deb/rpm download the new package and shell out to `dpkg -i` / `rpm -U` via privilege escalation** (`pkexec` → zenity/kdialog+`sudo` → terminal `sudo`). The package file itself is the updater artifact (no `.tar.gz` repackaging like AppImage); the bundler emits `<pkg>.deb.sig` / `<pkg>.rpm.sig` when `createUpdaterArtifacts: true` (already set).
- deb/rpm do **not** bundle WebKit (they depend on system `libwebkit2gtk-4.1`), so they are much smaller than the ~80 MB AppImage (~10–20 MB each).
- The app uses `dialog: false` (custom update UI in `src/components/update-dialog/`); the Rust updater plugin performs the install, the frontend just triggers it.

## Decisions (settled)

- **Enable full in-app auto-update for deb/rpm** (not AppImage-only). Accept the root/`pkexec` prompt-on-every-update UX and the documented edge cases (can fail on headless/Wayland-without-polkit; package-DB ownership can diverge from apt/dnf — tauri issue #4573). This is acceptable for a beta.
- **No rpm GPG package signing.** It only adds value behind a signed repo (users would have to import the public key for a direct download), so it's needless complexity at this stage. The Tauri updater minisign `.sig` remains the integrity mechanism.
- **No apt/yum repository.** Standing up and hosting a signed repo is a separate distribution channel — out of scope.
- All Linux builds are flagged **beta** on the website.

## Files in scope

- `.github/workflows/release.yml` — Ubuntu bundle args `appimage` → `appimage,deb,rpm`; add `rpm` to the apt install line. (This is PR #201's diff.)
- `.github/workflows/ci.yml` — mirror the same: Ubuntu bundle args `appimage` → `appimage,deb,rpm` and add `rpm` to its apt install line, so CI actually exercises deb/rpm and fails appropriately. (CI is opt-in via the `ci` label / `workflow_dispatch`.)
- The stable-named-asset + `SHA256SUMS` job from `task-1` — extend to include deb/rpm.
- `website/index.html` — add deb + rpm download buttons; flag all Linux builds as beta.
- `docs/developer/releases.md` — document Linux formats, deb/rpm auto-update behaviour + caveats, and Docker-based testing.

## Phased approach

### Phase 1 — Build config + verification spike (GATE — do this first)

Get definitive answers from a real build before wiring anything downstream.

1. Apply the build-config changes:
   - `release.yml`: Ubuntu args → `--bundles appimage,deb,rpm`; add `rpm` to apt install.
   - `ci.yml`: same two changes.
2. Confirm the packages **build** on the runner (the `rpm` tool must be present — that's why it's added to apt). Easiest path: trigger `ci.yml` via `workflow_dispatch` (or label a branch PR `ci`), which builds without creating a release.
3. Inspect `latest.json` from a real release build. `ci.yml` does not produce `latest.json`, so push a throwaway tag (e.g. `v0.0.0-linux-test`) to trigger `release.yml`, which creates a draft Release with `latest.json`. Confirm it contains `linux-x86_64-appimage`, `linux-x86_64-deb`, `linux-x86_64-rpm` keys, each with a valid `signature` and `url`, plus the generic `linux-x86_64` fallback. Then delete the tag and draft Release.
4. Sanity-check installation and the update prompt without a Linux machine, using Docker Desktop on macOS:
   - deb: `docker run --rm -it -v "$PWD:/x" ubuntu:22.04` then `apt-get update && apt-get install -y /x/<pkg>.deb` — confirm dependencies (e.g. `libwebkit2gtk-4.1`) resolve.
   - rpm: `docker run --rm -it -v "$PWD:/x" fedora:latest` then `rpm -i /x/<pkg>.rpm` (or `dnf install`).
   - A full GUI/auto-update run isn't feasible headlessly; the goal here is to confirm the packages install and their metadata/deps are sane. The `latest.json` inspection in step 3 is the real auto-update gate.

**Gate:** proceed only once deb/rpm build, install in Docker, and `latest.json` shows correct format-specific keys + signatures.

### Phase 2 — Release asset wiring

Extend the `task-1` stable-named-asset + checksum job to include the new formats:

- Add `*.deb` and `*.rpm` to the download patterns.
- Publish stable-named copies: `astro-editor-latest.deb`, `astro-editor-latest.rpm`.
- Include deb/rpm in `SHA256SUMS`.

### Phase 3 — Website

- Add **Download for Linux (.deb)** and **Download for Linux (.rpm)** buttons in the download section of `website/index.html`, linking to `/releases/latest/download/astro-editor-latest.{deb,rpm}` (AppImage button already added in `task-1`).
- Flag **all Linux builds as beta** (clear visual label/note near the Linux options).

### Phase 4 — Docs

Update `docs/developer/releases.md`:
- Linux now ships AppImage + deb + rpm.
- Auto-update behaviour per format (AppImage silent self-replace; deb/rpm via package manager + privilege prompt) and the known caveats.
- The Docker-based install testing approach for a Mac-only maintainer.

## Out of scope

- rpm GPG signing and apt/yum repositories (see Decisions).
- ARM Linux builds (x86_64 only, matching the current matrix).
- Homebrew cask (`brew install --cask astro-editor`) — separate, self-managing, Mac-only; untouched.

## Testing

- Build verification via `ci.yml` `workflow_dispatch` (no release needed).
- `latest.json` key/signature inspection via a throwaway release tag (then clean up).
- Docker-based install tests for deb (ubuntu) and rpm (fedora) on macOS.
- After Phase 2/3, confirm the new Linux download buttons fetch the correct packages and `sha256sum -c SHA256SUMS` passes.

## Success criteria

1. Tagged releases produce `.deb` and `.rpm` (plus AppImage) on GitHub Releases, with stable-named copies and entries in `SHA256SUMS`.
2. `ci.yml` builds all three Linux formats and fails if deb/rpm bundling breaks.
3. `latest.json` carries valid `linux-x86_64-deb` / `-rpm` / `-appimage` entries; deb/rpm installs can auto-update in-app.
4. The website offers AppImage, deb, and rpm downloads, all flagged beta.
5. `docs/developer/releases.md` documents the Linux formats, auto-update behaviour, and testing.
6. PR #201 is closed with a reference to this work.
