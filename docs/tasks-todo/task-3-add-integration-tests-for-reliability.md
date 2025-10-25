# Add Integration Tests for Reliability-Critical Paths

**Priority**: CRITICAL (blocks 1.0.0)
**Effort**: ~1 day
**Type**: Testing, reliability validation

## Problem

Tasks #1 (auto-save data loss) and #4 (file watcher race condition) fix genuine reliability risks. However, these are integration-level issues involving multiple systems working together:

- **Auto-save cycle**: Editor changes → debounced save → file write → query invalidation → UI update
- **File watcher cycle**: External change → watcher event → query invalidation → reload → editor update
- **Self-save detection**: Our save → watcher event → should ignore → no unnecessary reload

Without integration tests for these flows, we can't confidently verify the fixes work end-to-end.

## Current Testing Gaps

**What we have**:
- Unit tests for individual stores (editorStore, projectStore)
- Unit tests for utility functions
- Component tests for UI elements

**What we're missing**:
- Integration tests for store ↔ query interactions
- Integration tests for file system operations
- End-to-end tests for auto-save reliability
- End-to-end tests for file watcher behavior

**Evidence from meta-analysis**:
> "Before 1.0.0: Add integration tests for auto-save cycle and file watcher (your two risky areas)"

## Requirements

**Must Have**:
- [ ] Integration test: Auto-save fires during continuous typing (validates task #1 fix)
- [ ] Integration test: File watcher ignores self-initiated saves (validates task #4 fix)
- [ ] Integration test: File watcher detects external changes and reloads
- [ ] Integration test: Auto-save → query invalidation → no unnecessary refetch
- [ ] Tests run reliably in CI without flakiness

**Should Have**:
- [ ] Integration test: Auto-save with slow file operations (race condition scenarios)
- [ ] Integration test: Multiple rapid saves don't cause issues
- [ ] Integration test: Save failure handling and retry logic
- [ ] Clear test utilities for mocking Tauri commands

**Nice to Have**:
- [ ] Performance benchmarks for auto-save cycle
- [ ] Integration tests for crash recovery system
- [ ] Tests for concurrent file operations

## Test Scenarios to Cover

### 1. Auto-Save Reliability (Task #1 Validation)

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

### 2. File Watcher Behavior (Task #4 Validation)

**Test: Self-initiated saves don't trigger reload**
```typescript
it('should not reload editor when save completes', async () => {
  const { result: editorResult } = renderHook(() => useEditorStore())
  const queryClient = new QueryClient()

  // Edit content
  act(() => editorResult.current.setEditorContent('changed'))

  // Save
  await act(async () => {
    await editorResult.current.saveFile()
  })

  // Simulate file watcher event (with version tracking)
  const fileChangedEvent = new CustomEvent('file-changed', {
    detail: { path: 'test.md', version: 1 }
  })
  window.dispatchEvent(fileChangedEvent)

  // Verify: Query was NOT invalidated
  const queries = queryClient.getQueryCache().findAll()
  expect(queries.every(q => q.state.isInvalidated === false)).toBe(true)
})
```

**Test: External changes trigger reload**
```typescript
it('should reload editor when external change detected', async () => {
  // Setup: File loaded in editor

  // Simulate external change (no version or mismatched version)
  const externalChangeEvent = new CustomEvent('file-changed', {
    detail: { path: 'test.md', version: 999 } // Different version
  })
  window.dispatchEvent(externalChangeEvent)

  // Verify: Query was invalidated and refetched
  await waitFor(() => {
    expect(queryClient.getQueryCache().findAll().some(q => q.state.isInvalidated)).toBe(true)
  })
})
```

**Test: Race condition with slow save**
```typescript
it('should handle slow saves without triggering reload loop', async () => {
  // Mock slow save (2 seconds)
  mockInvoke.mockImplementation(() =>
    new Promise(resolve => setTimeout(resolve, 2000))
  )

  // Trigger save
  await act(async () => {
    await result.current.saveFile()
  })

  // File watcher fires while save is in progress
  // Should be ignored due to version tracking

  // Verify: No infinite loop, no unnecessary reloads
})
```

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

### Test Infrastructure Setup

1. **Mock Tauri Commands**
```typescript
// src/test/mocks/tauri.ts
export const mockInvoke = vi.fn()
export const mockListen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen
}))
```

2. **Test Utilities**
```typescript
// src/test/utils/integration-helpers.ts
export function setupEditorIntegrationTest() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  return { queryClient, wrapper }
}

export async function simulateContinuousTyping(
  store: EditorStore,
  duration: number,
  interval: number
) {
  const iterations = duration / interval
  for (let i = 0; i < iterations; i++) {
    act(() => store.setEditorContent(`content ${i}`))
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}
```

3. **File System Mocks**
```typescript
// src/test/mocks/filesystem.ts
export class MockFileSystem {
  private files = new Map<string, string>()

  async read(path: string): Promise<string> {
    return this.files.get(path) || ''
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content)
    // Optionally emit file-changed event
  }

  simulateExternalChange(path: string, content: string) {
    this.files.set(path, content)
    window.dispatchEvent(new CustomEvent('file-changed', {
      detail: { path, version: Date.now() }
    }))
  }
}
```

### Test Organization

**New test files**:
- `src/store/__tests__/editorStore.integration.test.ts` - Auto-save integration tests
- `src/store/__tests__/fileWatcher.integration.test.ts` - File watcher integration tests
- `src/store/__tests__/storeQueryIntegration.test.ts` - Store ↔ query interaction tests
- `src/test/utils/integration-helpers.ts` - Shared test utilities
- `src/test/mocks/` - Tauri and file system mocks

### Running Tests

```bash
# Run all integration tests
pnpm run test:integration

# Run specific integration suite
pnpm run test -- editorStore.integration

# Run with coverage
pnpm run test:coverage -- --include="**/integration.test.ts"
```

## Success Criteria

- [ ] Auto-save integration tests pass (continuous typing, debouncing, failure handling)
- [ ] File watcher integration tests pass (self-save ignore, external change detection, race conditions)
- [ ] Store ↔ query integration tests pass (invalidation, dirty state, file switching)
- [ ] All tests run reliably without flakiness
- [ ] Test coverage for integration paths > 80%
- [ ] CI runs integration tests on every commit
- [ ] Test utilities are documented and reusable
- [ ] Integration tests catch the bugs fixed in tasks #1 and #4 (regression prevention)

## Testing the Tests

To verify integration tests actually catch the bugs:

1. **Revert fix for task #1** (remove max delay fallback)
   - Integration test should fail with "auto-save never fired during continuous typing"

2. **Revert fix for task #4** (remove version tracking)
   - Integration test should fail with "self-save triggered unnecessary reload"

3. **Re-apply fixes**
   - All integration tests should pass

This validates the tests actually verify the fixes work.

## Out of Scope

- E2E tests with real Tauri runtime (integration tests use mocks)
- Visual regression tests
- Performance stress testing (>10k files, etc.)
- Multi-window interaction tests

## References

- Meta-analysis: `docs/reviews/analyysis-of-reviews.md` (Week 1, item #3)
- Staff Engineering Review: Recommended integration test coverage
- Existing tests: `src/store/__tests__/` (unit tests to build upon)
- Vitest docs: https://vitest.dev/guide/

## Dependencies

**Blocks**: None (can start immediately)
**Blocked by**: None (but validates fixes in tasks #1 and #4)
**Related**:
- Task #1 (auto-save fix) - this validates that fix works
- Task #4 (file watcher fix) - this validates that fix works
- Task #5 (Rust tests) - complementary backend testing

## Recommendation

**Do this in Week 1 alongside tasks #1 and #2**. The integration tests serve as acceptance criteria for the reliability fixes. You can even write the tests first (TDD approach) to define expected behavior before implementing fixes.

**Estimated effort**:
- Test infrastructure setup: 2 hours
- Auto-save integration tests: 2 hours
- File watcher integration tests: 2 hours
- Store/query integration tests: 1 hour
- Documentation and cleanup: 1 hour
- **Total: 1 full day**
