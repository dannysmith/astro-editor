# Upgrade tauri-action to v1

Dropped from the September 2026 dependency update because it can't be verified end to end before a real release. v1 gives us nothing we currently need; the main reason to do it is to stay current.

## Changes needed

In `.github/workflows/release.yml` and `ci.yml`, `tauri-apps/tauri-action@v0.6.2` → `@v1.0.0`, and in `release.yml`:

- `includeUpdaterJson` → `uploadUpdaterJson`
- Remove `updaterJsonKeepUniversal` (always on in v1)
- `tagName` can go (we pass `releaseId`), along with the comment saying it keeps updater URLs tag-pinned

The reverted commit `654b491a` has the exact diff.

## Risk

- `latest.json` download URLs change from `browser_download_url` to `api.github.com/repos/.../releases/assets/{id}`. `tauri-plugin-updater` (2.10+) sends `Accept: application/octet-stream`, so this should work, but it's subject to GitHub's unauthenticated API rate limit (60/hour per IP).
- `.app.tar.gz` asset names now include the version. `publish-stable-assets` only uses installers, so it should be unaffected.
- v1 updates the name/body of existing releases, but skips that when `releaseId` is passed.

## Verification

1. Push a throwaway `v*` tag (only `release.yml` runs; nothing is published). Check: one draft release with all assets, `latest.json` URL format and platforms, `publish-stable-assets` succeeded. Delete the tag and draft afterwards.
2. On the next real release, confirm an installed copy of the previous version updates. If the URLs break, hand-edit `latest.json` on the release back to browser download URLs.

Release notes: https://github.com/tauri-apps/tauri-action/releases/tag/action-v1.0.0
