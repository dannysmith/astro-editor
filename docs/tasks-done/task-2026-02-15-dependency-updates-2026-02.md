# Dependency Updates - February 2026

## Status

**Current Phase:** Finalization - Ready for PR
**Branch:** deps-2026-02-11

## Research Findings

### Dependabot PRs

| PR  | Description                                      | Type             | Status |
| --- | ------------------------------------------------ | ---------------- | ------ |
| 119 | 11 development-dependencies updates              | npm grouped      | ✅ Addressed |
| 118 | 10 production-dependencies updates               | npm grouped      | ✅ Addressed |
| 117 | 7 rust-dependencies updates                      | Cargo grouped    | ✅ Addressed |
| 115 | time 0.3.46 → 0.3.47                             | Cargo individual | ✅ Addressed |
| 114 | bytes 1.11.0 → 1.11.1                            | Cargo individual | ✅ Addressed |
| 112 | actions/upload-artifact 4 → 6                    | GitHub Actions   | ✅ Applied |
| 111 | actions/setup-node 4 → 6                         | GitHub Actions   | ✅ Applied |
| 110 | react-resizable-panels 3.0.6 → 4.5.6             | npm individual   | ✅ Upgraded to 4.6.2 |
| 106 | wrangler 4.60.0 → 4.61.1 (telemetry-worker)      | npm individual   | ✅ Upgraded to 4.64.0 |

### Major Version Bumps (npm)

| Package                  | Current | Latest | Status                                       |
| ------------------------ | ------- | ------ | -------------------------------------------- |
| `@eslint/js`             | 9.39.2  | 10.0.1 | Deferred - typescript-eslint doesn't support v10 yet |
| `eslint`                 | 9.39.2  | 10.0.0 | Deferred - typescript-eslint doesn't support v10 yet |
| `jsdom`                  | 27.4.0  | 28.0.0 | ✅ Updated                                    |
| `react-resizable-panels` | 3.0.6   | 4.6.2  | ✅ Updated with v4 API migration             |

### Pinned Package Status

| Package        | Current      | Latest | Decision | Notes                           |
| -------------- | ------------ | ------ | -------- | ------------------------------- |
| `specta`       | =2.0.0-rc.22 | rc.22  | Keep     | Still RC, no stable 2.0 yet     |
| `tauri-specta` | =2.0.0-rc.21 | rc.21  | Keep     | Still RC, no stable 2.0 yet     |

### pnpm Overrides

```json
"pnpm": {
  "overrides": {
    "@lezer/common": "^1.5.0"
  }
}
```

This override ensures consistent @lezer/common across all CodeMirror packages.

---

## Phase Checklist

### Main App
- [x] npm dependencies (non-pinned)
- [x] Cargo dependencies (non-pinned)
- [x] Review pinned packages (specta, tauri-specta) - kept, still RC
- [x] Handle react-resizable-panels v4 upgrade
- [x] Run check:all ✅
- [x] Production build (app compiles)

### Test Sites
- [x] demo-project (already on Astro 5.17.2)
- [x] dummy-astro-project (upgraded to Astro 5.17.2)
- [x] starlight-minimal (upgraded to Astro 5.17.2, Starlight 0.37.6)
- [x] Run reset:testdata

### Telemetry Worker
- [x] Update dependencies (wrangler 4.60.0 → 4.64.0)
- [x] Test staging deployment (dry-run passes)
- [x] Verify stats.sh works ✅

### Finalization
- [x] Apply GitHub Actions updates (upload-artifact v6, setup-node v6, download-artifact v6)
- [x] Run check:all ✅
- [x] Manual smoke test (user)
- [x] Push + create PR (user)
- [ ] Merge + verify CI (user)

---

## Decisions Log

1. **ESLint 10**: Deferred - typescript-eslint doesn't support ESLint 10 yet ([issue #11952](https://github.com/typescript-eslint/typescript-eslint/issues/11952))
2. **specta/tauri-specta**: Keep pinned at RC versions - no stable 2.0 release yet
3. **react-resizable-panels v4**: Upgraded - migrated resizable.tsx to v4 API (Group/Panel/Separator, orientation prop, reimplemented autoSaveId for localStorage persistence)

## Issues Encountered

1. **react-resizable-panels v4 API changes**: The v4 API removed `autoSaveId` prop. Reimplemented localStorage persistence in the wrapper component using `onLayoutChange` + `defaultLayout`.

## Key Changes Made

### react-resizable-panels v4 Migration
- Updated `src/components/ui/resizable.tsx`:
  - Changed imports from `PanelGroup, Panel, PanelResizeHandle` to `Group, Panel, Separator`
  - Changed `direction` prop to pass through as `orientation`
  - Changed CSS selectors from `data-[panel-group-direction=vertical]` to `aria-[orientation=vertical]`
  - Reimplemented `autoSaveId` functionality using `onLayoutChange` callback + `defaultLayout` prop

### GitHub Actions Updates
- Updated `.github/workflows/release.yml`:
  - `actions/setup-node@v4` → `actions/setup-node@v6`
  - `actions/upload-artifact@v4` → `actions/upload-artifact@v6`
  - `actions/download-artifact@v4` → `actions/download-artifact@v6`

### Test Sites
- Upgraded `dummy-astro-project` to Astro 5.17.2
- Upgraded `starlight-minimal` to Astro 5.17.2 + Starlight 0.37.6

### Telemetry Worker
- Upgraded wrangler 4.60.0 → 4.64.0

## Security Audit

One moderate vulnerability in test site's transitive dependency:
- `mdast-util-to-hast` in demo-project (via astro's markdown-remark)
- Not critical, in test site only, waiting for upstream fix
