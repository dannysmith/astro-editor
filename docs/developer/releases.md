# Releases

Releases are built by GitHub Actions from a version tag, left as a draft, and published by hand. Installers live only as GitHub Release assets, and the app updates itself from the release's `latest.json`. Test builds go through the same workflow and are published as prereleases.

## Cutting a release

1. On an up-to-date `main`, run `bun run prepare-release` (or `bun run prepare-release v2.0.0` to skip the prompt). It refuses a dirty working tree or a tag that already exists, proposes a patch bump, runs `check:all`, sets the version in `package.json`, `Cargo.toml` and `tauri.conf.json`, runs `bun install` and `cargo check`, then offers to make a GPG-signed commit and tag and push just the branch and that tag.
2. Pushing the `v*` tag starts `release.yml`. When it finishes, a draft release is waiting under GitHub → Releases.
3. Write the release notes in the draft and publish it. Publishing makes `latest.json` public, so existing users get the update, and fires `publish-release-notes.yml`, which adds the notes to the website.

Always use the script, so the three version numbers and the tag match.

## Hotfixes

When `main` has unreleased work and a release needs a fix, branch from the latest release tag instead of releasing `main`:

```bash
git switch -c hotfix/1.0.21 v1.0.20
# fix and commit
bun run prepare-release
```

`prepare-release` asks before releasing from a branch other than `main`, refuses one that doesn't contain the latest release tag, then works as usual. Once the release is published, open a PR from the hotfix branch into `main` and merge it, so `main` gets the fix and the version bump. `main`'s version files are still at the previous release, so they take the hotfix's version without a conflict, and the next release from `main` proposes the next patch. There's no long-lived release branch.

## Test builds

A test build is a signed, notarised production build of any commit, published as a GitHub prerelease for people to download and try. Run it from any branch:

```bash
bun run test-build "Try the new component picker"
bun run test-build --no-sign "..."   # skip the GPG prompt for the tag
```

It refuses a dirty working tree, works out the next version from the tags on GitHub, runs `check:all`, then tags `HEAD` and pushes only the tag. The branch doesn't need pushing. The tag's message becomes the release's name and notes. When every platform has built, `release.yml` publishes it as a prerelease and the script's URL works. Delete test builds when you're done with them, in the GitHub UI or with `gh release delete v1.0.21-test.3 --cleanup-tag`.

How it fits together:

- **Nothing is committed.** `release.yml` sets the version inside the runner with `scripts/release-version.js`, so no version change can end up on `main` or the feature branch.
- **The version is the patch after the latest stable release:** `1.0.21-test.1`, `1.0.21-test.2` and so on. `1.0.21-test.3` sorts below `1.0.21`, so the updater offers nothing until 1.0.21 ships and then moves testers onto it. A test build numbered from the current release (`1.0.20-test.3`) would be offered 1.0.20 straight away and lose whatever was being tested. Testers aren't offered later test builds; send them the new link.
- **Windows installers need a numeric version.** WiX only takes `major.minor.patch.build`, so `release-version.js` sets `bundle.windows.wix.version` to `1.0.21.3`. The MSI's filename keeps the full version. Tauri's WiX template allows downgrades, so the stable MSI installs over a test build.
- **It's the production app.** It has the same identifier, settings and telemetry uuid as the installed release and replaces it. The only difference is the version, which is also how the app knows it's a test build: any version with a `-` shows a "Test build" pill in the title bar.
- **Nothing outside the release notices.** The updater, the website's download links and the Homebrew cask's livecheck all go through `/releases/latest`, which skips prereleases, and `fetch_release_notes` filters them out. `publish-release-notes.yml` skips prereleases, and `generate-release-pages.ts` lists only published stable releases. `publish-stable-assets` doesn't run.

## Workflows

### `release.yml`: build and draft

Runs on a `v*` tag push. A tag containing `-` is a test build. The jobs run in sequence:

- **`create-release`** makes one empty draft up front and passes its `release_id` to the build jobs. If each matrix job found or created the release itself, a tauri-action race ([tauri-action#914](https://github.com/tauri-apps/tauri-action/issues/914)) can split the assets across several drafts, each with an incomplete `latest.json`. For a test build, the draft is marked as a prerelease and takes its name and notes from the tag's message.
- **`publish-tauri`** builds macOS (universal `.dmg` plus the `.app.tar.gz` updater artifact), Windows (`.msi`) and Linux (`.AppImage`, `.deb`, `.rpm`) in parallel. Each job uploads to the shared draft and merges its platform's entries into `latest.json`. For a test build, it sets the version first.
- **`publish-stable-assets`** (releases only) adds stable-named copies (`astro-editor-latest.dmg`, `.msi`, `.AppImage`, `.deb`, `.rpm`) and a `SHA256SUMS` covering both sets of names. The website links to `/releases/latest/download/astro-editor-latest.*`, which always resolves to the newest published release, so the site never changes per release.
- **`publish-test-build`** (test builds only) publishes the draft as a prerelease once every platform has uploaded. If a build fails it doesn't run, so nobody downloads a half-built release.

Release builds have no Rust cache and always build cold. They couldn't restore `ci.yml`'s cache anyway (different job id, env vars and profile), and a tag-scoped cache is never read again.

**Installers are never committed.** Committed installers once bloated `.git` to about 650 MB, and Git LFS doesn't help because GitHub Pages serves the pointer files instead of the binaries.

### `ci.yml`: build check

Runs on pushes to `main`, on a PR while it has the `ci` label, and by manual dispatch. Changes only to `docs/`, `website/` or top-level `*.md` don't trigger it.

- **`checks`** runs `bun run check:all` on Ubuntu.
- **`build`** runs `tauri build` on each platform without Apple signing or a release. It builds native arm64 only on macOS and turns off LTO and allows 16 codegen units through `CARGO_PROFILE_RELEASE_*`, to save time. It doesn't use `--debug`, which would compile dev-only code such as the agent bridge.
- **Only `main` saves the Rust cache.** A PR can restore caches from its own branch and from `main`, not from other PRs, so this gives every PR a warm cache without filling the 10 GB repo limit.
- **Dependabot's pushes run without repo secrets,** so a labelled Dependabot PR fails at updater signing. That's expected.

### `publish-release-notes.yml` and `deploy-website.yml`

Publishing a release (not a prerelease) runs `website/scripts/generate-release-pages.ts --all`, which turns each published stable release's body into `website/src/content/docs/releases/<version>.mdx` (skipping releases that already have a page, so reruns are safe), commits it to `main`, and dispatches `deploy-website.yml`. The dispatch is explicit because a push made with `GITHUB_TOKEN` doesn't trigger other workflows. `deploy-website.yml` otherwise runs on changes to `website/**` on `main`.

### Tooling notes

- **Bun installs, Node runs.** Vitest and the Tauri CLI run on Node, so both workflows keep `setup-node`.
- **tauri-action picks the package manager from the lockfile and checks for `pnpm-lock.yaml` before `bun.lock`.** A stray pnpm lockfile switches the build back to pnpm.

## Auto-updates

The updater plugin fetches `https://github.com/dannysmith/astro-editor/releases/latest/download/latest.json` (`plugins.updater` in `tauri.conf.json`). Draft releases don't serve it, so nothing reaches users until you publish.

- **`latest.json` points at GitHub API asset URLs.** tauri-action writes download URLs as `https://api.github.com/repos/dannysmith/astro-editor/releases/assets/{id}`, not `/releases/download/vX/<file>`. They only return the file with `Accept: application/octet-stream`, which every shipped version of the updater plugin sends, and each download counts against GitHub's unauthenticated API limit of 60 requests an hour per IP.
- **Release notes come from the GitHub API, not `latest.json`.** `latest.json`'s `notes` is whatever the draft said at build time. `fetch_release_notes` (`src-tauri/src/commands/updater.rs`) fetches the published notes when the dialog opens, combining every release between the installed and the new version. The dialog works without them.
- **When it checks:** 5 seconds after launch, unless the user skipped that version (stored in `localStorage`). "Check for Updates…" in the app menu always shows the dialog. Dev builds skip the automatic check.

To test an update, install a published release, publish a newer one, and launch the installed app.

### Linux

`latest.json` carries a generic `linux-x86_64` key plus `linux-x86_64-appimage`, `-deb` and `-rpm`. An installed app updates from the key for its own format.

- **AppImage** bundles its own WebKit and replaces itself in place, like macOS and Windows.
- **`.deb` and `.rpm`** depend on the system WebKitGTK and can't replace themselves. The updater installs the new package with `dpkg -i` or `rpm -U` through `pkexec` or `sudo`, so users get a password prompt on every update. It can fail where there's no polkit agent, and the package database's record can drift from what `apt` or `dnf` expect ([tauri#4573](https://github.com/tauri-apps/tauri/issues/4573)). We don't sign the packages or run a repository; integrity comes from the updater's minisign signatures. These trade-offs are accepted while Linux is in beta.

Danny has no Linux machine, so:

- `ci.yml` builds all three Linux formats and fails if bundling breaks.
- To check `latest.json`, run `bun run test-build`, confirm the prerelease's `latest.json` has the three format keys with URLs and signatures, then delete it.
- To check that the packages install and their dependencies resolve, use Docker on a Mac:

  ```bash
  docker run --rm -it -v "$PWD:/x" ubuntu:22.04 bash -c "apt-get update && apt-get install -y /x/astro-editor-latest.deb"
  docker run --rm -it -v "$PWD:/x" fedora:latest bash -c "dnf install -y /x/astro-editor-latest.rpm"
  ```

## Signing

There are two separate kinds of signing, each with its own repo secrets:

- **Updater signing** covers every platform. `TAURI_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` sign the update artifacts, and the matching public key is `plugins.updater.pubkey` in `tauri.conf.json`. CI builds need these too.
- **Apple code signing and notarisation** is macOS only and runs only in `release.yml`. `APPLE_CERTIFICATE` (the Developer ID Application `.p12`, base64) and `APPLE_CERTIFICATE_PASSWORD` are imported into the runner's keychain. `APPLE_API_KEY` (the key ID), `APPLE_API_ISSUER` and `APPLE_TEAM_ID` are for notarisation. Despite its name, `APPLE_API_KEY_PATH` holds the contents of the `.p8` key; the workflow writes it to `~/private_keys/AuthKey_<id>.p8` and passes that path to tauri-action.

Gotchas:

- **GPG-signing the release commit and tag is our choice, not Apple's.** Apple signing and notarisation only see the built app and the secrets above. An unsigned commit on a feature branch has signed and notarised in CI without trouble.
- **`APPLE_SIGNING_IDENTITY` must be set.** Without it, Tauri ad-hoc signs the app even with the certificate imported, and users see "app is damaged". It looks like a notarisation problem but isn't. `release.yml` sets it to the certificate's name.
- **Signing locally needs Apple's Developer ID G2 CA certificate** (`DeveloperIDG2CA.cer`) in your keychain, then build with `APPLE_SIGNING_IDENTITY` set.
- **Check a build with `codesign -dv <app>`.** A properly signed app shows `Authority=Developer ID Application: …` and a `TeamIdentifier`. `Signature=adhoc` with `TeamIdentifier=not set` means the identity wasn't used.

## Troubleshooting

- **Updates fail to download after publishing:** most likely the API asset URLs (see Auto-updates): the 60-an-hour limit, or an updater that doesn't send the `Accept` header. Hand-edit the release's `latest.json` so each URL is `https://github.com/dannysmith/astro-editor/releases/download/vX.Y.Z/<file>`. Users whose update failed get it on their next check.
- **Updates don't arrive:** check the release is published, not a draft, and that `pubkey` matches the private key. Then look in the app's log (see the Logs section of `agent-tooling.md`).
- **Release notes are missing from the dialog:** the API rate limit (above), or an empty release body.
- **Download links serve an old version:** check the latest published release has the `astro-editor-latest.*` assets. To backfill one, download its installers and run `gh release upload <tag> astro-editor-latest.* SHA256SUMS --clobber`.
