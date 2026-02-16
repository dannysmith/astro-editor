# Update Dialog with Release Notes

## Problem

The auto-updater currently uses browser `confirm()` and `alert()` dialogs, which:

- Show no release notes — users have no idea what's in the update
- Look out of place in a native app (browser chrome dialogs)
- Show no download progress
- Don't support "skip this version" or "remind me later"

Release notes are manually written in GitHub Releases before publishing. However, the `notes` field in `latest.json` is populated from the `releaseBody` template at build time — **not** from the hand-written release body you edit before publishing the draft. So `update.body` currently just contains the template header, not actual release notes.

Additionally, the release workflow has issues: draft releases trigger website artifact updates (making unreleased builds available via the website), and the release script requires manually specifying the version number.

## Solution

1. Rework the release process so website artifacts are only updated when a release is published (not drafted)
2. Improve the release script with auto-version detection
3. Fetch release notes from the GitHub Releases API via a Rust command (not from `latest.json`)
4. Replace browser dialogs with a custom shadcn/ui Dialog rendering markdown release notes
5. Support jumped versions by fetching all intermediate release notes

## Requirements

### Update Available Dialog

- Triggered automatically 5 seconds after launch (same as current behavior) or manually via "Check for Updates" menu item
- Shows: current version, new version, formatted release notes
- Release notes rendered as markdown using `marked`
- Three actions: **Update Now**, **Remind Me Later** (dismiss), **Skip This Version**
- "Skip This Version" persists the skipped version so the dialog won't show again for that version (until a newer one is available)
- For automatic checks, don't show the dialog if the user has skipped this version
- For manual checks ("Check for Updates" menu), always show even if skipped

### Jumped Versions

- When a user is multiple versions behind, show concatenated release notes for all intermediate versions (in reverse chronological order with version headers)
- Fetched via a Rust Tauri command that calls the GitHub Releases API
- Filter releases between current version and latest version; exclude pre-releases and drafts
- If the API call fails (e.g., no network), fall back gracefully — show the update dialog without release notes, or with a "Could not load release notes" message

### Download Progress

- After clicking "Update Now", the dialog transitions to a progress state
- Shows a progress bar using `downloadAndInstall()` event callbacks (`Started` → total size, `Progress` → chunk downloaded, `Finished`)
- Cancel button during download (if feasible — check if `downloadAndInstall` supports cancellation, otherwise omit)

### Post-Install Prompt

- After download completes, show "Restart Now" / "Later" options in the same dialog
- If "Later", the update will apply on next restart

### No Update Available (Manual Check)

- When manually triggered and no update exists, show a simple dialog (or toast) with current version: "You're on the latest version (v1.0.8)"
- This replaces the current `alert()` call

### Telemetry

The app currently sends a single telemetry event (`update_check`) on startup via Rust (`src-tauri/src/telemetry.rs`), posted to `https://updateserver.dny.li/event`. This is completely independent of the frontend update check — it fires from `lib.rs` setup. **This must continue working unchanged.** The frontend refactoring does not touch this code path, but verify it still fires correctly after changes.

## Implementation Plan

### Phase 0: Release Process Improvements

#### 0a. Verify `releaseBody` change in `release.yml`

The installation instructions have been removed from the `releaseBody` template (L107-109). The YAML is valid — the `|` block scalar contains just the version heading and a trailing blank line, and `releaseDraft: true` is correctly parsed as a sibling key.

**No action needed** — already done and valid.

#### 0b. Improve `prepare-release.js` — auto-version detection

Currently the script requires `pnpm run prepare-release v1.0.9`. Improve it to:

1. Read current version from `package.json`
2. Propose a patch bump (e.g., `1.0.8` → `1.0.9`)
3. Prompt: `Release version? (1.0.9):` — pressing Enter accepts the default, or type a different version
4. Version argument still accepted as override: `pnpm run prepare-release v2.0.0` skips the prompt
5. Fix the `git tag` command: add `-m "Release vX.Y.Z"` to prevent the editor opening. The current `git tag ${tagVersion}` creates a lightweight tag, but the global git config has `tag.forceSignAnnotated = true`, which forces it into an annotated tag and opens `$EDITOR` for the tag message. Adding `-m` provides the message inline.

**Modified file:** `scripts/prepare-release.js`

#### 0c. Split release workflow — separate build from website update

**Problem:** The current `release.yml` runs `update-website` immediately after building, which copies draft release artifacts to `website/` and triggers deployment. This means unreleased draft builds are served from the website.

**Solution:** Split into two workflows:

1. **`release.yml`** (build workflow) — triggered by tag push, builds all platforms, creates draft release with updater JSON. Remove the `update-website` job and artifact upload steps entirely.

2. **`publish-website-artifacts.yml`** (new) — triggered by `on: release: types: [published]`. This workflow:
   - Downloads the release assets (DMG, MSI, AppImage) from the published GitHub Release using `gh release download`
   - Copies them to `website/` with the `*-latest.*` naming convention
   - Commits to `main`
   - The existing `deploy-website.yml` (which triggers on `website/**` changes to `main`) handles deployment automatically

3. **`deploy-website.yml`** — no changes needed. Already triggers on `website/**` path changes to `main`.

**Benefits:**
- Website only gets artifacts from published (non-draft) releases
- Simpler `release.yml` — just builds and creates the draft
- `deploy-website.yml` is already wired up correctly via path trigger
- The new workflow uses `gh release download` to get assets directly from the release, avoiding the artifact upload/download dance between jobs

### Phase 1: Add `marked` for Markdown Rendering

```bash
pnpm add marked
```

`marked` is lightweight (~40KB), fast, and outputs HTML strings. DOMPurify is not needed since the markdown comes from our own GitHub Releases (trusted source). Render with `dangerouslySetInnerHTML` in a styled container.

### Phase 2: Rust Command for Fetching Release Notes

**New Rust command:** `fetch_release_notes(current_version: String, new_version: String) -> Result<String, String>`

Add to `src-tauri/src/commands/` (new file or existing module). Uses `reqwest` (already a dependency, used by `telemetry.rs`) to fetch from the GitHub Releases API:

```
GET https://api.github.com/repos/dannysmith/astro-editor/releases
```

The command:
1. Fetches all releases (public API, no auth needed)
2. Filters out drafts and pre-releases
3. Filters to releases between `current_version` and `new_version` (inclusive of new, exclusive of current) using semver comparison
4. Sorts reverse chronologically
5. Concatenates bodies with version headers into a single markdown string
6. Returns the combined markdown

**Why Rust instead of JS `fetch()`:** All outbound HTTP in the app is currently Rust-side (updater plugin, telemetry). Keeping release notes fetching in Rust avoids adding `https://api.github.com` to the CSP `connect-src`, keeping the CSP clean. The `reqwest` dependency is already available.

Register in `src-tauri/src/bindings.rs` and expose via tauri-specta. Frontend calls it as `commands.fetchReleaseNotes(currentVersion, newVersion)`.

**GitHub API notes:**
- Unauthenticated rate limit: 60 requests/hour per IP. Fine for a desktop app.
- Cache the result for the session — don't re-fetch on every dialog open.
- 5-second timeout (same as telemetry) to avoid blocking if network is slow.

### Phase 3: Create Update Store

**New file:** `src/store/updateStore.ts`

**Store shape:**
```typescript
interface UpdateState {
  // Dialog state
  dialogOpen: boolean
  dialogMode: 'checking' | 'available' | 'downloading' | 'ready' | 'no-update' | 'error'

  // Update info (from tauri-plugin-updater)
  version: string | null
  currentVersion: string | null
  errorMessage: string | null

  // The Update object from check() — needed for downloadAndInstall()
  // Stored as a non-reactive ref (not serializable, has methods)
  updateRef: Update | null

  // Release notes (fetched via Rust command from GitHub API)
  releaseNotes: string | null // Combined markdown for all intermediate versions
  releaseNotesLoading: boolean
  releaseNotesError: boolean

  // Download progress
  downloadProgress: number // 0-100
  downloadTotal: number | null

  // Skip tracking (persisted to localStorage)
  skippedVersion: string | null

  // Actions
  openDialog: () => void
  closeDialog: () => void
  setChecking: () => void
  setAvailable: (update: Update, version: string, currentVersion: string) => void
  setReleaseNotes: (notes: string) => void
  setReleaseNotesError: () => void
  setDownloading: () => void
  setProgress: (downloaded: number, total: number) => void
  setReady: () => void
  setNoUpdate: (currentVersion: string) => void
  setError: (message: string) => void
  skipVersion: (version: string) => void
}
```

**Important:** The `Update` object returned by `check()` must be stored so that `downloadAndInstall()` can be called later from the dialog. It has methods on it and is not serializable — store it as a plain reference in the store, not in localStorage or any serialized form.

**Skip version persistence:** Use `localStorage` (key: `astro-editor-skipped-update-version`). The store reads it on init and writes on skip.

### Phase 4: Create Update Dialog Component

**New files:**
- `src/components/update-dialog/UpdateDialog.tsx` — main dialog component
- `src/components/update-dialog/index.ts` — barrel export

**Component structure:**
```
UpdateDialog
├── State: "checking" | "available" | "downloading" | "ready" | "no-update" | "error"
├── checking → spinner (brief, shown during manual check)
├── available → version info + rendered release notes + action buttons
│   ├── Release notes area: scrollable, max-height, rendered markdown
│   ├── If releaseNotesLoading → small spinner in notes area
│   ├── If releaseNotesError → "Could not load release notes" fallback
│   └── Buttons: "Update Now" | "Skip This Version" | "Remind Me Later"
├── downloading → progress bar + percentage
├── ready → "Restart Now" / "Later"
├── no-update → current version confirmation (manual check only)
└── error → error message with dismiss
```

**Dialog design:**
- Use existing `Dialog` / `DialogContent` from `@/components/ui/dialog`
- Follow patterns from `PreferencesDialog.tsx` for open/close state management
- Release notes area should be scrollable with a max height
- Markdown rendered with `marked`, styled to match app typography

### Phase 5: Refactor Update Logic from App.tsx

**Modified file:** `src/App.tsx`

Replace `confirm()`/`alert()` calls with store actions:

1. On update found → `updateStore.getState().setAvailable(update, version, currentVersion)` + kick off `commands.fetchReleaseNotes()` in background
2. Release notes loaded → `updateStore.getState().setReleaseNotes(notes)`
3. On download progress → `updateStore.getState().setProgress(...)`
4. On download complete → `updateStore.getState().setReady()`
5. On no update (manual) → `updateStore.getState().setNoUpdate(currentVersion)`
6. On error → `updateStore.getState().setError(message)`

The actual `downloadAndInstall()` call uses `updateStore.getState().updateRef` to access the `Update` object. The `relaunch()` call uses `@tauri-apps/plugin-process` as before.

**Key behavior changes:**
- Automatic check: if `skippedVersion` matches the available version, silently ignore
- Manual check: always show dialog regardless of skipped version
- Mount `<UpdateDialog />` in `App.tsx` alongside `<Layout />`

### Phase 6: Polish

- Style the markdown output to match app typography (scoped CSS or Tailwind prose classes)
- Ensure the dialog looks good in both light and dark mode
- Test with real GitHub Release markdown (headings, lists, bold, links, code)
- Verify the progress bar works smoothly with real downloads
- Handle edge cases: empty release notes (show "No release notes for this version"), network errors during check

### Phase 7: Update Documentation

Update `docs/developer/releases.md` to reflect all changes:
- New `prepare-release.js` behavior (auto-version detection, no editor prompt)
- Split workflow: `release.yml` (build + draft) vs `publish-website-artifacts.yml` (on publish → website)
- How release notes flow from GitHub Release body → GitHub API → Rust command → update dialog
- The `latest.json` `notes` field limitation and why we fetch from the API instead

## Technical Notes

### Release Notes Data Flow

```
                                    ┌─ latest.json ─── version, URL, signature
GitHub Release (published) ────────┤
                                    └─ GitHub API ──── Rust command ──── frontend store ──── dialog
                                                        (fetched at runtime via reqwest)
```

The `latest.json` `notes` field is NOT used for release notes display — it only contains the template header from build time. Instead, the app fetches the actual published release body from the GitHub Releases API via a Rust Tauri command at runtime.

### Why Not Use `update.body` from `latest.json`?

`tauri-action` populates the `notes` field in `latest.json` from the `releaseBody` input at build time. But release notes are written manually in the GitHub Release draft _after_ the build completes. By the time you publish the release, `latest.json` already has the template text baked in. Fetching from the GitHub API at runtime gets the actual hand-written notes.

### Why Fetch via Rust Instead of JS?

All outbound HTTP in the app is Rust-side (updater plugin uses Rust, telemetry uses `reqwest`). Fetching release notes from Rust keeps this consistent and avoids needing to add `https://api.github.com` to the webview CSP `connect-src`. The `reqwest` crate is already a dependency.

### Existing Patterns to Follow

- **Dialog:** `PreferencesDialog.tsx` for open/close pattern
- **Store:** Follow decomposed store pattern from `editorStore`, `uiStore`
- **Toast:** Use `@/lib/toast` for non-dialog notifications (e.g., background update errors)
- **Menu events:** Keep existing `menu-check-updates` listener pattern
- **HTTP in Rust:** `telemetry.rs` for `reqwest` usage pattern with timeout

### Dependencies

- `marked` (new, frontend) — lightweight markdown-to-HTML renderer
- `reqwest` (existing, Rust) — already used by telemetry, reused for GitHub API fetch
- `@tauri-apps/plugin-updater` (existing) — update check, download, install
- `@tauri-apps/plugin-process` (existing) — `relaunch()` after install
- `@tauri-apps/plugin-log` (existing) — logging
