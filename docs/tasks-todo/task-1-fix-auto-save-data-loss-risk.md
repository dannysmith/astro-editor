# Fix Auto-Save Data Loss Risk

**Priority**: CRITICAL (blocks 1.0.0)
**Effort**: ~0.5-1 day
**Type**: Reliability, data integrity

## Problem

The current auto-save implementation clears and reschedules the timeout on every keystroke. This means if a user types continuously for an extended period (e.g., in flow state), auto-save never fires and changes are not saved to disk.

**Evidence**: `src/store/editorStore.ts:459-477`

```typescript
scheduleAutoSave: () => {
  const store = get()

  // Clear existing timeout
  if (store.autoSaveTimeoutId) {
    clearTimeout(store.autoSaveTimeoutId) // ⚠️ Resets on every keystroke
  }

  const timeoutId = setTimeout(() => {
    void store.saveFile(false)
  }, autoSaveDelay * 1000) // 2 seconds

  set({ autoSaveTimeoutId: timeoutId })
}
```

## Risk Scenario

1. User starts writing in flow state
2. Types continuously for 10+ minutes without pausing for >2 seconds
3. Auto-save never fires (timeout keeps getting reset)
4. App crashes, system loses power, or user force-quits
5. **All changes since last manual save are lost**

## Requirements

**Must Have**:

- [ ] Auto-save MUST fire within a maximum time window (e.g., 10 seconds) regardless of continuous typing
- [ ] Current debounced behavior should remain (don't save on every keystroke)
- [ ] No breaking changes to existing auto-save UX

**Nice to Have**:

- [ ] Persist dirty state to localStorage as backup

## Options for Implementation

### Option A: Force Save After Max Delay (Recommended)

Track time since last save. If it exceeds max delay (10s), force save immediately instead of debouncing.

**Pros**: Simple, handles continuous typing
**Cons**: Slight complexity in tracking last save time

### Option B: Periodic Save + Debounced Save

Run two timers: one for debouncing (2s), one for periodic backup (10s).

**Pros**: Clear separation of concerns
**Cons**: Two timers to manage

### Option C: Remove Debouncing Entirely

Just save every N seconds while content is dirty, period.

**Pros**: Simplest possible implementation
**Cons**: More disk I/O, might feel laggy on slow systems

## Context from Review

From staff engineering review:

> **Issues:**
>
> 1. **Continuous typing prevents save**: If user types for 10 minutes straight (e.g., during flow state), auto-save never fires
> 2. **No save queue**: If save fails, there's no retry mechanism
> 3. **Silent failures**: Failed auto-saves just log; user may not notice until data is lost
> 4. **No dirty state persistence**: If app crashes before auto-save fires, recent changes are lost
>
> **Impact:** **HIGH reliability risk** - potential data loss

## Implementation Notes

Current auto-save config:

- Delay: 2 seconds (defined in `editorStore.ts`) an configurable in preferences.
- Triggered on content/frontmatter changes
- Failures logged to console

Key files:

- `src/store/editorStore.ts` - `scheduleAutoSave()` function
- `src/store/editorStore.ts` - `saveFile()` function
- Auto-save scheduled from: `setEditorContent()`, `updateFrontmatterField()`, etc.

## Success Criteria

- [ ] User can type continuously for 15+ minutes and auto-save still fires within max delay
- [ ] Debounced behavior preserved (no save on every keystroke during normal typing)
- [ ] Failed auto-saves show toast notification to user
- [ ] Manual testing: type continuously for 15min, verify multiple auto-saves occurred
- [ ] Manual testing: kill app while dirty, verify recovery data exists or changes were saved

## Out of Scope

- Undo/redo for auto-saved changes (separate feature)
- Conflict resolution for external file changes (existing watcher handles this)
- Auto-save frequency configuration (keep at 2s debounce for 1.0.0)

## References

- Staff Engineering Review: `docs/reviews/2025-staff-engineering-review.md` (Issue #3)
- Current implementation: `src/store/editorStore.ts:459-477`
- Related: Recovery system already exists at `src/lib/recovery/`
