# Code Deduplication - Low-Hanging Fruit

**Priority**: Low (post-1.0.0)
**Effort**: ~1 day total
**Type**: Code quality, maintainability

## Overview

Simple, uncontroversial deduplication opportunities that reduce fragility and magic strings without adding architectural complexity. These are all 2-5 line changes that eliminate copy-paste patterns.

**Last Reviewed**: 2025-11-01 - Task updated to reflect current codebase state. Key changes:
- Item #3 updated: FileItem.tsx already has `getTitle()` helper; just need to use it consistently
- Item #5 updated: Found third location for "Open Project" flow (LeftSidebar.tsx)
- Item #7 updated: Drag/drop helpers already partially consolidated
- All other items remain valid and unchanged

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

### 3. Use Existing `getTitle()` Helper Consistently

**Issue**: File display name logic exists but isn't used everywhere
**Current State**: `src/components/layout/FileItem.tsx` exports `getTitle(file, titleField)` helper
**Locations not using it**:
- `src/components/ui/context-menu.tsx:194`: Uses `file.name || file.path.split('/').pop() || 'file'`

**Note**: `ReferenceField.tsx` intentionally uses a different, more comprehensive fallback (title → name → slug → id) since it's for reference lookups, not file display.

**Solution**: Update context-menu.tsx to import and use the existing `getTitle()` helper:
```typescript
import { getTitle } from '../layout/FileItem'

// In confirmation dialog:
const fileName = getTitle(file, 'title') // or get titleField from settings
```

**Why**: Reuse existing tested helper instead of creating new abstraction. The `getTitle()` helper is already properly handling frontmatter title field lookups with fallbacks.

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

**Issue**: Three implementations of project selection dialog
**Locations**:
- `src/lib/commands/app-commands.ts:111` (command palette - Open Project)
- `src/hooks/useLayoutEventListeners.ts:367` (menu event - menu-open-project)
- `src/components/layout/LeftSidebar.tsx:136` (sidebar - Open Project button)

**Solution**: Extract to `src/lib/projects/actions.ts`:
```typescript
export async function openProjectViaDialog(): Promise<void> {
  try {
    const projectPath = await invoke<string>('select_project_folder')
    if (projectPath) {
      useProjectStore.getState().setProject(projectPath)
      toast.success('Project opened successfully')
    }
  } catch (error) {
    toast.error('Failed to open project', {
      description: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
}
```

**Why**: Same user action has three implementations that can drift in error handling, messaging, and behavior. Centralizing ensures consistent UX.

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

**Issue**: `handleNoProjectFallback` and `handleNoFileFallback` are already effectively the same
**Location**: `src/lib/editor/dragdrop/edgeCases.ts:29-32`
**Current State**: `handleNoFileFallback` simply calls `handleNoProjectFallback`

**Solution**: Remove `handleNoFileFallback` entirely and rename `handleNoProjectFallback` to `buildFallbackMarkdownForPaths` for clarity. Update all call sites.

**Why**: Having two function names for the same behavior is confusing. A single, clearly-named function better expresses the intent.

---

## Non-Goals

This task explicitly EXCLUDES:
- Path/filename utilities abstraction (two implementations with different behaviors - keep separate)
- Command palette config generation (explicit > generated for 5 items)
- Point-in-rect helper (used in 2 places - Rule of Three not met)
- Field wrapper props helper (adds indirection for marginal benefit)
- Menu event listener loop generation (explicit mapping is clearer)

## Success Criteria

- [ ] Date formatting uses `lib/dates.ts` utilities (useCreateFile.ts, DateField.tsx)
- [ ] All IDE-opening flows use `lib/ide.ts` (app-commands.ts, context-menu.tsx)
- [ ] Context menu uses existing `getTitle()` helper from FileItem.tsx
- [ ] `NONE_SENTINEL` constant replaces all `"__NONE__"` strings (EnumField.tsx, ReferenceField.tsx)
- [ ] `openProjectViaDialog()` used by command palette, menu, and sidebar (3 locations)
- [ ] Hotkey options use shared constant in useLayoutEventListeners.ts
- [ ] Drag/drop uses single `buildFallbackMarkdownForPaths()` function
- [ ] No new architectural complexity introduced
- [ ] All tests pass

## Notes

These are all straightforward refactorings with clear before/after states. None introduce new patterns or abstractions - they just consolidate existing ones. Estimated 1-2 hours each, can be done incrementally.
