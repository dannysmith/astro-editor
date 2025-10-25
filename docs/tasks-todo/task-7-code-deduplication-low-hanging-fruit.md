# Code Deduplication - Low-Hanging Fruit

**Priority**: Low (post-1.0.0)
**Effort**: ~1 day total
**Type**: Code quality, maintainability

## Overview

Simple, uncontroversial deduplication opportunities that reduce fragility and magic strings without adding architectural complexity. These are all 2-5 line changes that eliminate copy-paste patterns.

## Tasks

### 1. Consolidate Date Formatting (HIGH VALUE)

**Issue**: `new Date().toISOString().split('T')[0]` appears in multiple places
**Locations**:
- `src/hooks/useCreateFile.ts`
- `src/components/frontmatter/fields/DateField.tsx`

**Solution**: Create `src/lib/dates.ts`:
```typescript
export function formatIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function todayIsoDate(): string {
  return formatIsoDate(new Date())
}
```

**Why**: Pattern is fragile around timezones and repeated. Single utility strengthens correctness.

---

### 2. Consolidate "Open in IDE" Behavior

**Issue**: IDE invocation logic appears in two places with different error handling
**Locations**:
- `src/lib/commands/app-commands.ts` (`executeIdeCommand`)
- `src/components/ui/context-menu.tsx` (inline `invoke('open_path_in_ide')`)

**Solution**: Extract to `src/lib/ide.ts`:
```typescript
export async function openInIde(path: string, ideCmd?: string): Promise<void> {
  const ide = ideCmd || useProjectStore.getState().globalSettings?.general?.ideCommand

  try {
    await invoke('open_path_in_ide', { path, ideCommand: ide })
    toast.success(`Opened in ${ide || 'IDE'}`)
  } catch (error) {
    toast.error(`Failed to open in IDE: ${error}`)
    console.error('IDE open failed:', error)
  }
}
```

**Why**: Two code paths means inconsistent UX/error handling. Single source ensures uniform behavior.

---

### 3. Unify File Display Name Logic

**Issue**: Different fallback patterns for deriving user-facing file labels
**Locations**:
- `src/components/layout/LeftSidebar.tsx`: `file.name || file.path.split('/').pop() || 'Untitled'`
- `src/lib/commands/app-commands.ts`: prefers `frontmatter.title` when available
- `src/components/frontmatter/fields/ReferenceField.tsx`: tiered fallback (title → name → slug → id → filename)

**Solution**: Create `src/lib/files/display.ts`:
```typescript
export function getFileDisplayName(file: FileEntry): string {
  // Comprehensive fallback chain
  if (file.frontmatter?.title) return file.frontmatter.title
  if (file.name) return file.name
  if (file.frontmatter?.slug) return file.frontmatter.slug
  if (file.id) return file.id
  const filename = file.path.split('/').pop()
  return filename || 'Untitled'
}
```

**Why**: Inconsistent display heuristics across UI is confusing. One rule improves predictability.

---

### 4. Extract Magic String Sentinel

**Issue**: `"__NONE__"` hardcoded in multiple field components
**Locations**:
- `src/components/frontmatter/fields/EnumField.tsx`
- `src/components/frontmatter/fields/ReferenceField.tsx`

**Solution**: Create `src/components/frontmatter/fields/constants.ts`:
```typescript
export const NONE_SENTINEL = '__NONE__'
```

**Why**: Magic strings are brittle. Shared constant prevents typos and documents intent.

---

### 5. Unify "Open Project" Flow

**Issue**: Two implementations of project selection dialog
**Locations**:
- `src/lib/commands/app-commands.ts` (command palette)
- `src/hooks/useLayoutEventListeners.ts` (menu event)

**Solution**: Extract to `src/lib/projects/actions.ts`:
```typescript
export async function openProjectViaDialog(): Promise<void> {
  try {
    const projectPath = await invoke('select_project_folder')
    useProjectStore.getState().setProject(projectPath)
    toast.success('Project opened')
  } catch (error) {
    if (error !== 'User cancelled') {
      toast.error(`Failed to open project: ${error}`)
    }
  }
}
```

**Why**: Same user action shouldn't have two implementations that can drift.

---

### 6. Default Hotkey Options Constant

**Issue**: Same options object repeated in multiple `useHotkeys` calls
**Location**: `src/hooks/useLayoutEventListeners.ts`

**Solution**: Add local constant:
```typescript
const DEFAULT_HOTKEY_OPTS = {
  preventDefault: true,
  enableOnFormTags: true,
  enableOnContentEditable: true,
}

// Then use:
useHotkeys('mod+s', handleSave, DEFAULT_HOTKEY_OPTS)
```

**Why**: Simple DRY win. Reduces noise, no architectural cost.

---

### 7. Consolidate Drag/Drop Fallback Helpers

**Issue**: `handleNoProjectFallback` and `handleNoFileFallback` are identical
**Location**: `src/lib/editor/dragdrop/edgeCases.ts`

**Solution**: Keep single `buildFallbackMarkdownForPaths(filePaths: string[])`

**Why**: Tiny, but unnecessary duplication.

---

## Non-Goals

This task explicitly EXCLUDES:
- Path/filename utilities abstraction (two implementations with different behaviors - keep separate)
- Command palette config generation (explicit > generated for 5 items)
- Point-in-rect helper (used in 2 places - Rule of Three not met)
- Field wrapper props helper (adds indirection for marginal benefit)
- Menu event listener loop generation (explicit mapping is clearer)

## Success Criteria

- [ ] Date formatting uses `lib/dates.ts` utilities
- [ ] All IDE-opening flows use `lib/ide.ts`
- [ ] File display names consistent via `getFileDisplayName()`
- [ ] `NONE_SENTINEL` constant replaces all `"__NONE__"` strings
- [ ] `openProjectViaDialog()` used by both command palette and menu
- [ ] Hotkey options use shared constant
- [ ] Drag/drop fallbacks consolidated
- [ ] No new architectural complexity introduced
- [ ] All tests pass

## Notes

These are all straightforward refactorings with clear before/after states. None introduce new patterns or abstractions - they just consolidate existing ones. Estimated 1-2 hours each, can be done incrementally.
