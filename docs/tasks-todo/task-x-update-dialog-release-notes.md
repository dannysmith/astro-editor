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
3. Fetch release notes from the GitHub Releases API at runtime (not from `latest.json`)
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
- Fetch from GitHub Releases API: `GET https://api.github.com/repos/dannysmith/astro-editor/releases`
- Filter releases between current version and latest version
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
5. Remove the tag editor invocation — use `-m "chore: release vX.Y.Z"` directly

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

`marked` is lightweight (~40KB), fast, and outputs HTML strings. Use `DOMPurify` is not needed since the markdown comes from our own GitHub Releases (trusted source). Render with `dangerouslySetInnerHTML` in a styled container.

### Phase 2: Create Update Store

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

  // Release notes (fetched from GitHub API)
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
  setAvailable: (version: string, currentVersion: string) => void
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

**Skip version persistence:** Use `localStorage` (key: `astro-editor-skipped-update-version`). The store reads it on init and writes on skip.

### Phase 3: Create Update Dialog Component

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

### Phase 4: Fetch Release Notes from GitHub API

**New file:** `src/lib/release-notes.ts`

Fetches release notes from the public GitHub Releases API (no auth needed for public repos):

```typescript
const RELEASES_URL = 'https://api.github.com/repos/dannysmith/astro-editor/releases'

async function fetchReleaseNotes(currentVersion: string, newVersion: string): Promise<string> {
  // 1. Fetch all releases (paginated if needed, but unlikely for this project)
  // 2. Filter to releases between currentVersion and newVersion (inclusive of new, exclusive of current)
  // 3. Sort reverse chronologically
  // 4. Concatenate bodies with version headers:
  //    ## v1.0.9
  //    <release body>
  //
  //    ## v1.0.8
  //    <release body>
  // 5. Return combined markdown string
}
```

**Called from:** The update check flow in App.tsx. After `check()` returns an update, fetch release notes in parallel (non-blocking — the dialog shows immediately with a loading state for the notes area).

**Fallback:** If the fetch fails, set `releaseNotesError: true` and the dialog shows the update info without notes. The user can still update.

### Phase 5: Refactor Update Logic from App.tsx

**Modified file:** `src/App.tsx`

Replace `confirm()`/`alert()` calls with store actions:

1. On update found → `updateStore.getState().setAvailable(version, currentVersion)` + kick off `fetchReleaseNotes()` in background
2. Release notes loaded → `updateStore.getState().setReleaseNotes(notes)`
3. On download progress → `updateStore.getState().setProgress(...)`
4. On download complete → `updateStore.getState().setReady()`
5. On no update (manual) → `updateStore.getState().setNoUpdate(currentVersion)`
6. On error → `updateStore.getState().setError(message)`

The actual `downloadAndInstall()` and `relaunch()` calls live in a `useUpdateActions()` hook (following the hybrid action hooks pattern) or as simple async functions called from the dialog's button handlers.

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

## Technical Notes

### Release Notes Data Flow

```
                                    ┌─ latest.json ─── version, URL, signature
GitHub Release (published) ────────┤
                                    └─ GitHub API ──── release notes markdown
                                                        (fetched at runtime)
```

The `latest.json` `notes` field is NOT used for release notes display — it only contains the template header from build time. Instead, the app fetches the actual published release body from the GitHub Releases API at runtime.

### Why Not Use `update.body` from `latest.json`?

`tauri-action` populates the `notes` field in `latest.json` from the `releaseBody` input at build time. But release notes are written manually in the GitHub Release draft _after_ the build completes. By the time you publish the release, `latest.json` already has the template text baked in. Fetching from the GitHub API at runtime gets the actual hand-written notes.

### Existing Patterns to Follow

- **Dialog:** `PreferencesDialog.tsx` for open/close pattern
- **Store:** Follow decomposed store pattern from `editorStore`, `uiStore`
- **Toast:** Use `@/lib/toast` for non-dialog notifications (e.g., background update errors)
- **Menu events:** Keep existing `menu-check-updates` listener pattern

### Dependencies

- `marked` (new) — lightweight markdown-to-HTML renderer
- `@tauri-apps/plugin-updater` (existing) — update check, download, install
- `@tauri-apps/plugin-process` (existing) — `relaunch()` after install
- `@tauri-apps/plugin-log` (existing) — logging

### CSP Consideration

The app's CSP in `tauri.conf.json` will need to allow `connect-src` to `https://api.github.com` for the release notes fetch. Check current CSP and add if needed.

### Phase 7: Update Documentation

Update `docs/developer/releases.md` to reflect all changes:
- New `prepare-release.js` behavior (auto-version detection, no editor prompt)
- Split workflow: `release.yml` (build + draft) vs `publish-website-artifacts.yml` (on publish → website)
- How release notes flow from GitHub Release body → GitHub API → update dialog
- The `latest.json` `notes` field limitation and why we fetch from the API instead
