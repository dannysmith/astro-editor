# Add Integration Tests for Reliability-Critical Paths

**Priority**: CRITICAL (blocks 1.0.0)
**Effort**: ~4-6 hours (reduced due to existing test infrastructure)
**Type**: Testing, reliability validation

## Current Status (Updated 2025-10-25)

✅ **Task #1 (Auto-save fix)**: COMPLETE (commit `f3d5749`)
❌ **Task #4 (File watcher fix)**: NOT STARTED
✅ **Test Infrastructure**: Tauri and Query mocks already exist

**Document Updates**:
- ✅ Scoped to Phase 1 (auto-save tests only)
- ✅ Acknowledged existing test infrastructure (reduces effort from 8h → 4-6h)
- ✅ Deferred file watcher tests to Phase 2 (when task #4 is implemented)
- ✅ Focused requirements on validating task #1 fix
- ✅ Updated implementation plan to leverage existing mocks

## Problem

Task #1 (auto-save data loss fix) addresses a genuine reliability risk involving multiple systems:

- **Auto-save cycle**: Editor changes → debounced save → force save after 10s → file write → query invalidation → UI update

Without integration tests for this flow, we can't confidently verify the fix works end-to-end.

**Note**: Task #4 (file watcher) is not yet implemented, so this task focuses on testing the auto-save implementation. File watcher tests can be added later when task #4 is complete.

## Current Testing Gaps

**What we have**:
- Unit tests for individual modules (editorStore handlers, utility functions)
- Component tests for UI elements
- **Existing test infrastructure**: `src/test/setup.ts` with Tauri mocks, TanStack Query mocks
- Rust unit tests in various command modules

**What we're missing**:
- Integration tests for store ↔ Tauri ↔ query interactions
- Integration tests for auto-save timing behavior (debounce + max delay)
- Integration tests for save failure handling
- Tests that verify the actual auto-save fix from task #1

**Evidence from meta-analysis**:
> "Before 1.0.0: Add integration tests for auto-save cycle and file watcher (your two risky areas)"

## Requirements

**Must Have** (Phase 1 - Auto-Save):
- [ ] Integration test: Auto-save fires within 10s during continuous typing (validates task #1 fix)
- [ ] Integration test: Debouncing still works for normal typing (don't spam saves)
- [ ] Integration test: Save failure shows toast notification
- [ ] Integration test: Auto-save → Tauri command → query invalidation flow
- [ ] Tests run reliably in CI without flakiness

**Should Have** (Phase 1):
- [ ] Integration test: Multiple rapid edits don't cause race conditions
- [ ] Integration test: Opening new file cancels pending auto-save
- [ ] Integration test: Manual save clears auto-save timeout

**Future** (Phase 2 - When Task #4 is Complete):
- [ ] Integration test: File watcher ignores self-initiated saves
- [ ] Integration test: File watcher detects external changes and reloads
- [ ] Integration test: Version tracking prevents reload loops

**Out of Scope**:
- E2E tests with real Tauri runtime (integration tests use mocks)
- Performance benchmarks
- Crash recovery tests (separate task)
- Multi-window interaction tests

## Test Scenarios to Cover

**Phase 1 Scope**: Auto-save and store/query integration tests only. File watcher tests deferred to Phase 2.

### 1. Auto-Save Reliability (Task #1 Validation) ⭐ PRIORITY

**Test: Continuous typing triggers auto-save within max delay**
```typescript
it('should auto-save within 10s even during continuous typing', async () => {
  // Setup: Open file
  const { result } = renderHook(() => useEditorStore())

  // Simulate continuous typing (keystroke every 500ms for 15 seconds)
  for (let i = 0; i < 30; i++) {
    act(() => {
      result.current.setEditorContent(`content ${i}`)
    })
    await waitFor(() => new Promise(resolve => setTimeout(resolve, 500)))
  }

  // Verify: Auto-save was called at least once during this period
  expect(mockInvoke).toHaveBeenCalledWith('save_markdown_content', ...)

  // Verify: No more than 2 saves (one at ~2s, one at ~10s force save)
  expect(mockInvoke).toHaveBeenCalledTimes(2)
})
```

**Test: Debouncing still works for normal typing**
```typescript
it('should debounce saves during normal typing pauses', async () => {
  // Type, pause 500ms, type, pause 500ms (under 2s threshold)
  // Should only save once after final pause exceeds 2s
})
```

**Test: Failed auto-save shows toast notification**
```typescript
it('should show error toast when auto-save fails', async () => {
  mockInvoke.mockRejectedValue('Disk full')

  // Trigger auto-save
  act(() => result.current.setEditorContent('new content'))

  // Wait for auto-save attempt
  await waitFor(() => expect(mockToast.error).toHaveBeenCalled())
})
```

### 2. File Watcher Behavior (Future - Phase 2)

**⚠️ Note**: These tests should be added when Task #4 (file watcher race condition fix) is implemented. Keeping here for reference.

<details>
<summary>Click to expand future test scenarios</summary>

**Test: Self-initiated saves don't trigger reload**
```typescript
it('should not reload editor when save completes', async () => {
  // Test version-based tracking (when implemented)
  // This validates that self-saves are correctly ignored
})
```

**Test: External changes trigger reload**
```typescript
it('should reload editor when external change detected', async () => {
  // Test that changes from external editors trigger reload
  // This validates external change detection works
})
```

**Test: Race condition with slow save**
```typescript
it('should handle slow saves without triggering reload loop', async () => {
  // Test that slow saves (>1s) don't cause issues
  // This validates the version tracking prevents race conditions
})
```

</details>

### 3. Store ↔ Query Integration

**Test: Editing frontmatter schedules auto-save**
```typescript
it('should schedule auto-save when frontmatter changes', async () => {
  act(() => {
    result.current.updateFrontmatterField('title', 'New Title')
  })

  await waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('save_markdown_content', ...)
  }, { timeout: 3000 }) // Wait up to 3s for auto-save
})
```

**Test: Manual save invalidates file content query**
```typescript
it('should invalidate query after successful save', async () => {
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

  await act(async () => {
    await result.current.saveFile()
  })

  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: expect.arrayContaining(['fileContent'])
  })
})
```

**Test: Opening file resets dirty state**
```typescript
it('should reset dirty state when opening new file', async () => {
  // Make file dirty
  act(() => result.current.setEditorContent('dirty'))
  expect(result.current.isDirty).toBe(true)

  // Open different file
  act(() => result.current.openFile(differentFile))

  // Dirty state should be reset
  expect(result.current.isDirty).toBe(false)
})
```

## Implementation Approach

### Leveraging Existing Infrastructure

✅ **Already Available** (`src/test/setup.ts`):
- Tauri mocks: `mockInvoke`, `mockListen` (via `globalThis.mockTauri`)
- Project registry mocks
- TanStack Query mocks (`src/test/mock-hooks.ts`)
- Vitest + jsdom environment

### What Needs to Be Created

1. **Integration Test Utilities** (`src/test/utils/integration-helpers.ts`)
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from '@testing-library/react'

export function setupEditorIntegrationTest() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  // Reset Tauri mocks before each test
  globalThis.mockTauri.reset()

  return { queryClient, wrapper }
}

export async function simulateContinuousTyping(
  setContent: (content: string) => void,
  durationMs: number,
  intervalMs: number
) {
  const iterations = Math.floor(durationMs / intervalMs)
  for (let i = 0; i < iterations; i++) {
    act(() => setContent(`content ${i}`))
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
}

export function advanceTimersByTime(ms: number) {
  vi.advanceTimersByTime(ms)
}
```

2. **Toast Mock** (for testing error notifications)
```typescript
// src/test/mocks/toast.ts
import { vi } from 'vitest'

export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}

vi.mock('../../lib/toast', () => ({
  toast: mockToast,
}))
```

### Test Organization

**New test files** (Phase 1):
- `src/store/__tests__/editorStore.integration.test.ts` - Auto-save integration tests (PRIORITY)
- `src/store/__tests__/storeQueryIntegration.test.ts` - Store ↔ query interaction tests
- `src/test/utils/integration-helpers.ts` - Shared test utilities
- `src/test/mocks/toast.ts` - Toast notification mocks

**Future** (Phase 2 - when task #4 is done):
- `src/store/__tests__/fileWatcher.integration.test.ts` - File watcher integration tests

**Existing** (leverage these):
- `src/test/setup.ts` - Tauri mocks, global setup
- `src/test/mock-hooks.ts` - TanStack Query mocks

### Running Tests

```bash
# Run all tests (including new integration tests)
pnpm run test

# Run integration tests only
pnpm run test -- integration.test

# Run specific suite
pnpm run test -- editorStore.integration

# Run with coverage
pnpm run test -- --coverage
```

## Success Criteria

**Phase 1 (Must Complete)**:
- [ ] Auto-save integration tests pass and validate task #1 fix:
  - [ ] Force save after 10s during continuous typing
  - [ ] Debouncing works for normal typing (no spam)
  - [ ] Save failure shows toast notification
- [ ] Store ↔ query integration tests pass (query invalidation, dirty state)
- [ ] All tests run reliably without flakiness (100% pass rate in CI)
- [ ] Test utilities created and documented
- [ ] Integration tests would catch regression if task #1 fix was reverted

**Phase 2 (Future - when task #4 done)**:
- [ ] File watcher integration tests pass (self-save ignore, external changes, version tracking)
- [ ] Integration tests validate task #4 fix

**Quality Metrics**:
- [ ] Integration test coverage for auto-save paths > 80%
- [ ] CI runs integration tests on every commit
- [ ] No flaky tests (deterministic, no race conditions in tests themselves)

## Testing the Tests (Validation)

To verify integration tests actually catch regressions:

**Phase 1 - Validate Auto-Save Tests**:

1. **Temporarily revert task #1 fix**:
   ```typescript
   // In editorStore.ts, comment out the force-save logic:
   /*
   if (store.isDirty && store.lastSaveTimestamp) {
     const timeSinceLastSave = now - store.lastSaveTimestamp
     if (timeSinceLastSave >= MAX_AUTO_SAVE_DELAY_MS) {
       void store.saveFile(false)
       return
     }
   }
   */
   ```

2. **Run integration tests**:
   - ❌ Test should FAIL with "auto-save never fired during continuous typing"
   - This proves the test catches the bug

3. **Re-apply fix**:
   - ✅ All integration tests should PASS
   - This proves the fix works

**Phase 2 - Validate File Watcher Tests** (when task #4 is done):
- Same process: revert fix, test should fail, re-apply fix, test should pass

## Out of Scope

- E2E tests with real Tauri runtime (integration tests use mocks)
- Visual regression tests
- Performance stress testing (>10k files, etc.)
- Multi-window interaction tests
- File watcher tests (deferred to Phase 2 when task #4 is implemented)

## References

- **Task #1**: `docs/tasks-todo/task-1-fix-auto-save-data-loss-risk.md` (✅ COMPLETE - commit `f3d5749`)
- **Task #4**: `docs/tasks-todo/task-4-fix-file-watcher-race-condition.md` (❌ NOT STARTED)
- **Existing Infrastructure**: `src/test/setup.ts`, `src/test/mock-hooks.ts`
- Meta-analysis: `docs/reviews/analyysis-of-reviews.md` (Week 1, item #3)
- Vitest docs: https://vitest.dev/guide/

## Dependencies

**Blocks**: Nothing (tests are validation, not blockers)
**Blocked by**: Nothing (task #1 is complete, can write tests now)
**Related**:
- ✅ Task #1 (auto-save fix) - COMPLETE, ready to test
- ❌ Task #4 (file watcher fix) - NOT STARTED, tests deferred to Phase 2
- Task #2 (YAML parser) - COMPLETE (commit `ef9abfe`)

## Recommendation

**Do Phase 1 now** to validate the task #1 auto-save fix before 1.0.0. This provides regression coverage and confidence in the reliability fix.

**Phased Approach**:
- **Phase 1** (Now): Auto-save integration tests (~4-6 hours)
- **Phase 2** (After task #4): File watcher integration tests (~2-3 hours)

**Estimated effort** (Phase 1 only):
- Test utilities creation: 1 hour (leverage existing mocks)
- Auto-save integration tests: 2 hours
- Store/query integration tests: 1 hour
- Documentation and validation: 1 hour
- **Total: 4-6 hours** (reduced from original 8 hours due to existing infrastructure)
