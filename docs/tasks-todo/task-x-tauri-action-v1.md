# Upgrade tauri-action to v1 and release v1.0.18

Dropped from the September 2026 dependency update (#325) until the updater risk was understood. That's now done (see [Risk](#risk)), so this ships together with the dependency updates in a single release.

## Plan

1. [ ] **Production build smoke test on `main`** — `pnpm tauri build --bundles app --no-sign --config '{"bundle":{"createUpdaterArtifacts":false}}'`, then Danny runs the `.app`: vibrancy (now `windowEffects` config), saving files, opening projects, no reloads
2. [ ] **Re-apply tauri-action v1 on a branch + PR** (revert the revert of `654b491a`) so PR CI runs the build with v1. Merge once green
3. [ ] **Release v1.0.18** via `pnpm run prepare-release`. Before publishing the draft, verify it (see [Verification](#verification)). If anything's wrong: delete draft + tag, revert to v0.6.2, re-tag — nothing is user-visible until publish
4. [ ] **Publish**, then confirm unauthenticated downloads work and an installed 1.0.17 copy updates itself

## Changes

In `.github/workflows/release.yml` and `ci.yml`, `tauri-apps/tauri-action@v0.6.2` → `@v1.0.0`, and in `release.yml`:

- `includeUpdaterJson` → `uploadUpdaterJson`
- Remove `updaterJsonKeepUniversal` (always on in v1)
- Remove `tagName` (we pass `releaseId`) and the comment saying it keeps updater URLs tag-pinned

## Risk

The only user-facing change is the download URLs in `latest.json`: v1 writes `https://api.github.com/repos/dannysmith/astro-editor/releases/assets/{id}` instead of `https://github.com/.../releases/download/vX/file`. The API URL only returns the file when requested with `Accept: application/octet-stream`.

Checked (October 2026):

- **Every installed version sends that header.** All released versions shipped `tauri-plugin-updater` 2.9.0 (≤ v1.0.7), 2.10.0 (v1.0.8–v1.0.12) or 2.10.1 (v1.0.14–v1.0.17). All three set `Accept: application/octet-stream` in `Update::download` unless a custom `Accept` is passed, and the check request's `application/json` header is applied to a local copy only. The app calls `check()` with no options.
- **GitHub serves it unauthenticated.** Downloading v1.0.17's `Astro.Editor_universal.app.tar.gz` via `api.github.com/.../releases/assets/459724731` with that header and no auth returned the identical 12 MB file as the browser download URL.
- **Rate limit**: each update download now counts against GitHub's unauthenticated API limit (60 requests/hour per IP). Only matters for many users behind one IP.
- **No deadline**: v0.6.2 already runs on `node24`, so staying on it isn't urgent — v1 just keeps us current.
- Other v1 changes don't affect us: `.app.tar.gz` names now include the version (`publish-stable-assets` only uses installers); v1 updates existing release name/body but skips that when `releaseId` is passed.

## Verification

**Before publishing the draft** (draft assets need auth, so use `gh`):

- [ ] One draft release with all platform assets plus the stable `astro-editor-latest.*` copies and `SHA256SUMS`
- [ ] `latest.json` has every platform (darwin aarch64/x86_64/universal incl. `-app`, linux, windows) and API-style URLs
- [ ] Each `latest.json` URL, fetched with `Accept: application/octet-stream` (authenticated), returns the same bytes as the corresponding asset

**After publishing:**

- [ ] `releases/latest/download/latest.json` fetched without auth shows v1.0.18; one platform URL downloads without auth
- [ ] An installed v1.0.17 updates to v1.0.18 via the in-app updater

**If the updater breaks after publishing:** hand-edit the release's `latest.json` so its URLs point at `https://github.com/dannysmith/astro-editor/releases/download/v1.0.18/<file>` instead. Users who failed just get the update on their next check.

Release notes: https://github.com/tauri-apps/tauri-action/releases/tag/action-v1.0.0
