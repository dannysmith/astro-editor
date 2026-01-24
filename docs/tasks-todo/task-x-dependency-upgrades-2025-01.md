# Dependency Upgrades - January 2025

## Current Status

**Phase 1:** Complete ✅ (commit ee8001b)
**Phase 2:** Complete ✅ (commit 269b35f)
**Phase 3:** Deferred (see below)
**Syntax Regression:** Fixed ✅

---

## Completed Work

### Phase 1 & 2: Dependency Updates

Updated ~45 npm packages and ~100 Cargo crates via `pnpm update` and `cargo update`. Notable updates included CodeMirror packages, Tauri plugins, React 19.2.3, and various dev dependencies.

### Syntax Highlighting Regression (Fixed)

After updating `@lezer/common` from 1.2.3 → 1.5.0, markdown syntax marks appeared in wrong colors due to a behavior change in `@lezer/highlight` 1.2.2.

**Root cause:** `@lezer/highlight` 1.2.2 fixed an issue where new styleTags would drop old rules. Now old rules are preserved and checked first. The built-in `@lezer/markdown` maps all marks to `tags.processingInstruction`, which matched before our contextual rules could be evaluated.

**Fix applied:**
1. Changed `tags.processingInstruction` styling from brown to mdtag (gray) in `highlightStyle.ts` - fixes most marks
2. Created `syntax-mark-decorations.ts` extension that decorates mark nodes with custom classes, styled in `theme.ts`:
   - `HeaderMark` inside `ATXHeading` → `.cm-heading-mark` (pink, bold)
   - `EmphasisMark` inside `Emphasis` → `.cm-emphasis-mark` (gray, italic)
   - `EmphasisMark` inside `StrongEmphasis` → `.cm-strong-mark` (gray, bold)

**Files changed:**
- `src/lib/editor/syntax/highlightStyle.ts` - processingInstruction → mdtag color
- `src/lib/editor/extensions/syntax-mark-decorations.ts` - new extension
- `src/lib/editor/extensions/theme.ts` - mark class styling
- `src/lib/editor/extensions/createExtensions.ts` - added extension

---

## Phase 3: Breaking Changes (Deferred)

### `react-resizable-panels` (3.0.6 → 4.5.1)

**Decision:** Defer until shadcn/ui updates their component.

v4 has breaking API changes (`PanelGroup` → `Group`, `direction` → `orientation`, numeric sizes → string percentages). shadcn/ui hasn't migrated yet and has [open issues](https://github.com/shadcn-ui/ui/issues/9136) about v4 incompatibility.

### `specta` & `tauri-specta` (Pinned RC versions)

**Decision:** Keep pinned. Still in Release Candidate, no stable 2.0 release yet.

---

## Phase 4: Not Updating (Intentional)

| Package | Current | Reason |
|---------|---------|--------|
| `babel-plugin-react-compiler` | ~1.0.0 | Tilde pin, React Compiler still maturing |
| `specta` | =2.0.0-rc.22 | RC version, awaiting stable |
| `tauri-specta` | =2.0.0-rc.21 | RC version, awaiting stable |
| `reqwest` (Cargo) | 0.12.x | Major version jump to 0.13.1 |
| `swc_ecma_parser` (Cargo) | 29.x | Major version jump to 33.0.0 |

---

## Remaining Work

### Other

- [ ] Review all editor extensions and ensure we have clear comments at the top describing exactly what they do and why they exist.
- [ ] Investigate possibility of upgrading...
  - [ ]  `reqwest` (Cargo) | 0.12.x | Major version jump to 0.13.1
  - [ ] `swc_ecma_parser` (Cargo) | 29.x | Major version jump to 33.0.0

### Sub-Projects

**Test Astro Projects** (in `test/`):
1. Upgrade Astro to 5.16.15 using `pnpm dlx @astrojs/upgrade`
2. Check for other upgradeable packages
3. Manual smoke test in browser
4. Test with Astro Editor

**Telemetry Worker:**
- Upgrade dependencies per https://github.com/dannysmith/astro-editor/pull/93
- Verify it still works

### Finishing Up

- [ ] Run all checks and manually smoke test
- [ ] Clean up task doc and move to `tasks-done/`
- [ ] Check for CodeRabbit suggestions and CI build
- [ ] Merge `deps-2026-01-24` into `main`

---

## Notes

- Last comprehensive update: October 2025
- All Radix UI packages are current
- Tailwind v4 and shadcn/ui v4 already on latest
