# Task 1: Add Intel Build Support

## Status
🧪 IN TESTING - v0.1.26 draft release (branch: add-intel-build)

## Context
Currently building only Apple Silicon (ARM) DMG. Need to support Intel-based Macs as well.

## Requirements

1. **Update release.yml** - Create second build for Intel architecture
2. **Update prepare-release.js** - Update if relevant for dual architecture
3. **Update deploy-website.yml** - Move both Intel and ARM DMGs to website
4. **Update website** - Add download button for Intel build
5. **Auto-updater** - Ensure correct architecture detection and update delivery
6. **Documentation** - Update all relevant docs with new build process

## Research Findings

### Tauri v2 Multi-Architecture Build Approaches

**Two Primary Approaches:**

1. **Universal Binary (RECOMMENDED)**
   - Single DMG containing both Intel (x86_64) and ARM (aarch64) executables
   - Built using: `--target universal-apple-darwin`
   - Requires both Rust targets installed:
     ```bash
     rustup target add aarch64-apple-darwin
     rustup target add x86_64-apple-darwin
     ```
   - File size: ~2x larger (includes both architectures)
   - User experience: Single download, works on both architectures
   - Best practice for 2025: macOS 26 (Tahoe) is last Intel version, but Universal is still recommended

2. **Separate Architecture Builds**
   - Two separate DMGs: one for Intel, one for ARM
   - Built using matrix strategy with individual targets
   - Smaller individual file sizes
   - Requires users to choose correct download
   - More complex updater configuration

**Tauri v2 Support:**
- Universal binary support confirmed via `universal-apple-darwin` target
- Must use proper npm syntax: `npm run tauri build -- --target universal-apple-darwin`
- The `--` delimiter is critical for passing flags to tauri-cli
- Both architectures compile in a single build command

### GitHub Actions Matrix Strategy

**For Separate Builds:**
```yaml
strategy:
  matrix:
    include:
      - platform: 'macos-latest'
        args: '--target aarch64-apple-darwin'
      - platform: 'macos-latest'
        args: '--target x86_64-apple-darwin'
```
- Creates two parallel jobs
- Each produces architecture-specific artifacts
- Tauri-action automatically generates correct latest.json entries

**For Universal Binary:**
```yaml
strategy:
  matrix:
    include:
      - platform: 'macos-14' # ARM runner
        args: '--target universal-apple-darwin'
```
- Single job produces universal binary
- Must install both Rust targets on runner
- Use `updaterJsonKeepUniversal: true` in tauri-action
- Runner must be ARM-based (macos-14) for cross-compilation to work

### Auto-Updater Architecture Detection

**How It Works:**
- Tauri automatically detects user's architecture at runtime
- Uses `{{arch}}` variable that resolves to: `x86_64`, `i686`, `aarch64`, or `armv7`
- Matches against platform keys in latest.json

**JSON Structure for Separate Builds:**
```json
{
  "platforms": {
    "darwin-x86_64": {
      "url": "https://github.com/.../Astro_Editor_0.1.26_x64.dmg",
      "signature": "..."
    },
    "darwin-aarch64": {
      "url": "https://github.com/.../Astro_Editor_0.1.26_aarch64.dmg",
      "signature": "..."
    }
  }
}
```

**JSON Structure for Universal Binary:**
```json
{
  "platforms": {
    "darwin-universal": {
      "url": "https://github.com/.../Astro_Editor_0.1.26_universal.dmg",
      "signature": "..."
    },
    "darwin-aarch64": {
      "url": "https://github.com/.../Astro_Editor_0.1.26_universal.dmg",
      "signature": "..."
    },
    "darwin-x86_64": {
      "url": "https://github.com/.../Astro_Editor_0.1.26_universal.dmg",
      "signature": "..."
    }
  }
}
```

**Tauri-Action Configuration:**
- `includeUpdaterJson: true` - Enables auto-updater JSON generation (default)
- `updaterJsonKeepUniversal: true` - Adds darwin-universal entry and populates both architecture-specific entries with universal binary
- Automatic architecture detection ensures correct download

## Implementation Plan

### RECOMMENDED: Universal Binary Approach

This is the simplest and most user-friendly approach. Single DMG works on all Macs.

#### Step 1: Update release.yml

**Changes needed:**
1. Add both Rust targets installation step (before build step)
2. Change args from `'--bundles app,dmg'` to `'--target universal-apple-darwin --bundles app,dmg'`
3. Add `updaterJsonKeepUniversal: true` to tauri-action configuration
4. Update DMG copy step to handle new filename pattern

```yaml
- name: Install Rust targets for universal binary
  if: matrix.platform == 'macos-14'
  run: |
    rustup target add aarch64-apple-darwin
    rustup target add x86_64-apple-darwin

- name: Build and release
  uses: tauri-apps/tauri-action@v0.5.22
  env:
    # ... existing env vars ...
  with:
    tagName: ${{ github.ref_name || inputs.version }}
    releaseName: 'Astro Editor ${{ github.ref_name || inputs.version }}'
    releaseBody: |
      ## Astro Editor ${{ github.ref_name || inputs.version }}

      ### Installation Instructions
      - **macOS**: Download the `.dmg` file (Universal - works on both Intel and Apple Silicon)
    releaseDraft: true
    prerelease: false
    includeUpdaterJson: true
    updaterJsonKeepUniversal: true
    args: '--target universal-apple-darwin --bundles app,dmg'
```

#### Step 2: Update deploy-website.yml

**No changes needed** - Already copies DMG file. The universal DMG will work for all architectures.

#### Step 3: Update website

**Changes needed:**
1. Update download button text to indicate "Universal (Intel & Apple Silicon)"
2. Single download button serves all users

```html
<!-- website/index.html -->
<a href="astro-editor-latest.dmg" class="download-button">
  Download for macOS
  <span class="download-subtitle">Universal Binary (Intel & Apple Silicon)</span>
</a>
```

#### Step 4: Update prepare-release.js

**No changes needed** - Script already handles version bumping correctly. Universal binary doesn't affect versioning.

#### Step 5: Update Documentation

**Files to update:**
1. `docs/release-process.md`:
   - Add note about universal binary build
   - Update artifact list to show `Astro Editor_0.1.X_universal.dmg`
   - Explain that single DMG works for both architectures

2. `docs/developer/apple-signing-setup.md`:
   - Add note that universal binaries require both Rust targets
   - Signing process is identical (signs both architectures automatically)

3. `README.md` (if it has download instructions):
   - Update to mention universal binary support

### ALTERNATIVE: Separate Builds Approach

Only use if universal binary creates unacceptable file size bloat (unlikely for this app).

#### Step 1: Update release.yml

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: 'macos-14'
        args: '--target aarch64-apple-darwin --bundles app,dmg'
        arch: 'aarch64'
      - platform: 'macos-14'
        args: '--target x86_64-apple-darwin --bundles app,dmg'
        arch: 'x86_64'

# ... then in copy DMG step:
- name: Copy DMG to website folder
  if: matrix.platform == 'macos-14'
  run: |
    DMG_FILE=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -1)
    if [ -n "$DMG_FILE" ]; then
      echo "Found DMG: $DMG_FILE"
      if [ "${{ matrix.arch }}" = "aarch64" ]; then
        cp "$DMG_FILE" website/astro-editor-latest-arm.dmg
      else
        cp "$DMG_FILE" website/astro-editor-latest-intel.dmg
      fi
    fi
```

#### Step 2: Update deploy-website.yml

**No changes needed** - Would deploy both DMGs.

#### Step 3: Update website

Add two download buttons:
```html
<a href="astro-editor-latest-arm.dmg">Download for Apple Silicon (M1/M2/M3)</a>
<a href="astro-editor-latest-intel.dmg">Download for Intel Mac</a>
```

## ✅ Changes Implemented

### `.github/workflows/release.yml`

**1. Added Rust Targets Installation (after line 55)**
```yaml
- name: Install Rust targets for universal binary
  if: matrix.platform == 'macos-14'
  run: |
    rustup target add aarch64-apple-darwin
    rustup target add x86_64-apple-darwin
```
- **Location**: After "Install frontend dependencies" step
- **Purpose**: Installs both ARM and Intel Rust toolchains required for universal binary
- **Safe**: Doesn't touch any signing or notarization configuration

**2. Updated Matrix Args (line 27)**
```yaml
# BEFORE:
args: '--bundles app,dmg'

# AFTER:
args: '--target universal-apple-darwin --bundles app,dmg'
```
- **Purpose**: Tells Tauri to build a universal binary instead of architecture-specific
- **Impact**: Single build creates both ARM and Intel executables in one DMG

**3. Added updaterJsonKeepUniversal (line 108)**
```yaml
includeUpdaterJson: true
updaterJsonKeepUniversal: true  # NEW
args: ${{ matrix.args }}
```
- **Purpose**: Generates latest.json with darwin-universal, darwin-aarch64, and darwin-x86_64 entries
- **Critical**: Ensures existing ARM users and new Intel users can both find the update

**4. Updated Release Body (line 102)**
```yaml
# BEFORE:
- **macOS**: Download the `.dmg` file and drag Astro Editor to the Applications folder.

# AFTER:
- **macOS**: Download the `.dmg` file (Universal - works on both Intel and Apple Silicon) and drag Astro Editor to the Applications folder.
```
- **Purpose**: Clearly communicates that single DMG works on all Macs

### `website/index.html`

**Updated Download Button (line 310-336)**
```html
<!-- BEFORE: Single line text -->
<span>Download for macOS</span>

<!-- AFTER: Two-line button with subtitle -->
<div class="flex flex-col items-start">
  <span>Download for macOS</span>
  <span class="text-xs text-white/70 font-normal">Universal (Intel & Apple Silicon)</span>
</div>
```
- **Purpose**: Clearly communicates universal binary support to users
- **Also updated**: aria-label for accessibility

### What Stays the Same (Critical!)

**✅ All signing configuration unchanged:**
- `APPLE_SIGNING_IDENTITY` - Same
- Certificate import step - Unchanged
- API key creation - Unchanged
- `TAURI_SIGNING_PRIVATE_KEY` - Same
- Notarization config - Unchanged

**✅ DMG copy step unchanged:**
- Uses `find` to locate any .dmg file
- Works with both "aarch64" and "universal" filenames automatically

**✅ No changes needed to:**
- `prepare-release.js` - Versioning works the same (see Testing Notes for branch handling)
- `deploy-website.yml` - Already copies DMG correctly

### Auto-Updater Behavior

**Existing v0.1.25 users (ARM only):**
- App checks: `https://github.com/dannysmith/astro-editor/releases/latest/download/latest.json`
- Finds: `darwin-aarch64` entry pointing to universal DMG
- Downloads: Universal DMG (works perfectly)
- Result: Seamless upgrade ✅

**New Intel users:**
- App checks: Same latest.json URL
- Finds: `darwin-x86_64` entry pointing to same universal DMG
- Downloads: Universal DMG (works perfectly)
- Result: Intel support ✅

**File size change:**
- Current: 6.2MB (ARM only)
- Expected: ~12-13MB (Universal)
- Impact: Acceptable for better compatibility

## Potential Challenges

### Universal Binary Approach

1. **File Size**: Universal binary will be ~2x the size
   - **Mitigation**: Acceptable for most users, DMG compression helps
   - **Current ARM-only size**: Check actual size to estimate impact

2. **Cross-Compilation**: Must ensure both targets work correctly
   - **Mitigation**: Test universal binary on both Intel and ARM Macs
   - **GitHub Actions**: Use macos-14 (ARM runner) which can cross-compile to Intel

3. **Code Signing**: Both architectures must be signed
   - **Mitigation**: Tauri handles this automatically with `APPLE_SIGNING_IDENTITY`
   - **Notarization**: Apple notarizes both architectures in single submission

### Separate Builds Approach

1. **User Confusion**: Users must choose correct download
   - **Mitigation**: Clear labeling and auto-detection on website

2. **Updater Complexity**: Must maintain two separate DMGs
   - **Mitigation**: Tauri-action handles latest.json generation automatically

3. **Website Updates**: Must copy both DMGs to website folder
   - **Mitigation**: Update workflow to handle both files

4. **Testing Overhead**: Must test both builds separately
   - **Mitigation**: More QA time required

## Recommendation

**Use Universal Binary Approach** for these reasons:

1. **Simplicity**: Single build, single DMG, single download button
2. **User Experience**: Users don't need to know their architecture
3. **Industry Standard**: Most macOS apps ship as universal binaries in 2025
4. **Auto-Updater**: Simpler configuration with `updaterJsonKeepUniversal`
5. **Maintenance**: Less complex CI/CD and website management
6. **Future-Proof**: Even though macOS 26 is last Intel version, support is still needed
7. **File Size**: Trade-off is acceptable for improved UX

The only reason to use separate builds would be if the universal binary size becomes prohibitively large (e.g., >500MB), which is unlikely for this application.

## Testing Approach

### Branch Strategy for Safe Testing

**Testing on `add-intel-build` branch before merging to `main`:**

This allows testing the changes in isolation without affecting the main branch until verified.

**Why this works:**
1. Tag triggers workflow (not branch)
2. Workflow checks out the **tag** (which points to branch commit)
3. Builds the code from the tag regardless of which branch it was created on
4. Draft release created for manual verification
5. Main branch untouched until ready to merge

### Release Process for Testing

**Using prepare-release.js on non-main branch:**

```bash
# 1. Run prepare-release (updates versions, creates commit & tag)
pnpm run prepare-release 0.1.26

# 2. When prompted "Would you like me to execute these git commands? (y/N):"
#    Answer: N (because script hardcodes 'main' branch)

# 3. Manually push with correct branch name:
git push origin add-intel-build --tags
```

**Critical:** The script's `git push origin main --tags` at line 158 is hardcoded, so we must answer 'N' and push manually with the correct branch name.

### Test Verification Checklist

**1. Draft Release Verification (GitHub Releases page):**
- [ ] DMG filename includes "universal" (e.g., `Astro Editor_0.1.26_universal.dmg`)
- [ ] File size is approximately 12-13MB (double the current 6.2MB)
- [ ] `.sig` signature file present
- [ ] Release body shows "Universal - works on both Intel and Apple Silicon"
- [ ] Release is marked as "Draft"

**2. latest.json Verification:**
- [ ] Download latest.json from release assets
- [ ] Verify contains `darwin-universal` entry
- [ ] Verify contains `darwin-aarch64` entry (for existing ARM users)
- [ ] Verify contains `darwin-x86_64` entry (for Intel users)
- [ ] All three entries point to same universal DMG URL
- [ ] Signatures present for all three entries

**3. DMG Installation Testing (on test Mac):**
- [ ] Download universal DMG from draft release
- [ ] Install on Mac
- [ ] Verify app launches successfully
- [ ] Check Activity Monitor: app should show "Apple" or "Intel" (not "Intel (Rosetta)")
- [ ] Test basic functionality (open project, edit file, save)

**4. Auto-Updater Testing (if time permits):**
- [ ] Install v0.1.25 on test Mac
- [ ] Publish v0.1.26 draft release
- [ ] Launch v0.1.25 app
- [ ] Verify update notification appears within 5 seconds
- [ ] Click "Update" and verify installation succeeds
- [ ] Verify app relaunches successfully on v0.1.26

**5. Website Testing (after merge to main):**
- [ ] Website DMG downloads correctly
- [ ] Download button shows "Universal (Intel & Apple Silicon)" subtitle
- [ ] DMG filename is `astro-editor-latest.dmg`

### Expected Outcomes

**Success Criteria:**
1. ✅ Universal DMG builds without errors
2. ✅ File size approximately doubles (6.2MB → ~12-13MB)
3. ✅ latest.json has all three platform entries
4. ✅ App runs natively on both architectures (no Rosetta)
5. ✅ Existing ARM users can update seamlessly
6. ✅ All signing and notarization passes

**If Issues Arise:**
- Draft release allows testing without affecting users
- Can delete tag and draft release if needed
- Make fixes on branch and try again
- Only merge to main after full verification

### Post-Testing: Merge to Main

Once v0.1.26 draft release is verified:

```bash
# Switch to main
git checkout main
git pull origin main

# Merge the branch
git merge add-intel-build

# Push to main (workflow already ran on tag, no re-trigger)
git push origin main

# Manually publish the draft release on GitHub
```

## Implementation Session Summary

**Date:** 2025-10-16
**Branch:** `add-intel-build`
**Test Version:** v0.1.26

### Key Decisions Made

1. **Universal Binary Chosen:** After thorough research, universal binary approach selected for:
   - Simplicity (single build, single DMG)
   - User experience (no architecture selection needed)
   - Industry standard for 2025
   - Auto-updater simplicity

2. **Minimal Changes Strategy:** Only 4 surgical changes to release.yml:
   - Rust targets installation
   - Matrix args update
   - updaterJsonKeepUniversal flag
   - Release body text update
   - **All signing/notarization config preserved intact**

3. **Branch Testing Approach:** Test on feature branch before merging to main:
   - Safer than testing directly on main
   - Can delete/retry if issues arise
   - Draft release prevents user impact

### Critical Findings

1. **prepare-release.js Branch Handling:**
   - Script hardcodes `git push origin main --tags` at line 158
   - Solution: Answer 'N' to auto-push prompt, manually push with correct branch
   - This is the ONLY difference when testing on non-main branch

2. **Auto-Updater Compatibility:**
   - `updaterJsonKeepUniversal: true` generates all three platform entries
   - Existing ARM users will find `darwin-aarch64` entry
   - New Intel users will find `darwin-x86_64` entry
   - Both point to same universal DMG - seamless upgrade

3. **File Size Impact:**
   - Current ARM-only: 6.2MB
   - Expected Universal: ~12-13MB
   - Acceptable trade-off for compatibility

### Files Modified

1. `.github/workflows/release.yml` - 4 precise changes (lines 27, 57-61, 102, 108)
2. `website/index.html` - Download button updated (lines 310-336)
3. `docs/tasks-todo/task-1-intel-arm-builds.md` - This documentation

### Files NOT Modified (Intentionally)

1. `scripts/prepare-release.js` - Works as-is with manual push workaround
2. `.github/workflows/deploy-website.yml` - Already handles universal DMG
3. `docs/release-process.md` - Already showed `universal.dmg` in examples
4. `docs/developer/apple-signing-setup.md` - Signing process identical
5. `docs/developer/architecture-guide.md` - Not relevant to build process

### Next Steps After Successful Test

1. Verify all items in Test Verification Checklist
2. If successful: Merge `add-intel-build` → `main`
3. Manually publish draft release on GitHub
4. Monitor for any user reports on Intel Macs
5. Update task status to ✅ COMPLETED
6. Move task to `docs/tasks-done/`

## References

### Tauri Documentation
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri v2 Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [Tauri v2 GitHub Workflows](https://v2.tauri.app/distribute/pipelines/github/)
- [Building universal macOS binaries - Discussion #9419](https://github.com/tauri-apps/tauri/discussions/9419)
- [Tauri Action Repository](https://github.com/tauri-apps/tauri-action)

### Apple Documentation
- [Building a universal macOS binary](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary)

### Implementation Examples
- [Tauri Action action.yml](https://github.com/tauri-apps/tauri-action/blob/dev/action.yml) - Configuration options
- [Tauri Auto-updater Guide](https://thatgurjot.com/til/tauri-auto-updater/)

### Project Files
- `.github/workflows/release.yml` - Current release workflow
- `scripts/prepare-release.js` - Release preparation script
- `.github/workflows/deploy-website.yml` - Website deployment
- `docs/release-process.md` - Release documentation
- `docs/developer/apple-signing-setup.md` - Apple signing guide

### Research Notes
- macOS 26 (Tahoe, Sept 2025) is last Intel-supported version
- Universal binaries are industry standard for 2025
- Tauri v2 fully supports `universal-apple-darwin` target
- Auto-updater handles architecture detection automatically
