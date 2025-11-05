# Staff Engineering Review: Astro Editor Codebase
**Date:** January 2025
**Reviewer Perspective:** Experienced Staff Engineer (React/Rust/Tauri)
**Review Scope:** Complete codebase architectural analysis

## Executive Summary

Astro Editor is a well-architected application with strong foundations: decomposed state management, comprehensive documentation, and thoughtful separation of concerns. However, several architectural patterns have accumulated complexity that will increasingly impact maintainability, reliability, and developer velocity as the project scales.

This review focuses on **substantial architectural recommendations**, not nitpicks. Each issue identified has real impact on:
- **Reliability**: Risk of data loss, race conditions, or unexpected behavior
- **Maintainability**: Difficulty adding features or debugging issues
- **Performance**: Unnecessary re-renders, over-fetching, or bundle bloat
- **Developer Experience**: Time to understand and modify code

---

## Critical Issues

### 1. Event-Driven Bridge Pattern is Becoming Untenable

**Location:** `src/store/editorStore.ts:308-354`, `src/hooks/useLayoutEventListeners.ts` (entire file)

**Problem:**
The codebase uses DOM custom events to bridge between contexts that can't use React hooks (Zustand stores) and contexts that can (React components with TanStack Query). While clever, this pattern has evolved into a significant architectural liability:

**Evidence:**
```typescript
// In saveFile() - polling for schema field order via events
window.dispatchEvent(new CustomEvent('get-schema-field-order', {...}))

await new Promise(resolve => {
  const checkResponse = () => {
    if (responseReceived) {
      resolve(null)
    } else {
      setTimeout(checkResponse, 10) // Polling every 10ms!
    }
  }
  checkResponse()
})
```

**Issues:**
1. **No type safety**: All events use `CustomEvent<any>` - TypeScript can't help
2. **Polling anti-pattern**: Active polling to simulate synchronous communication
3. **Hard to debug**: Event flow requires tracing across files
4. **Testing nightmare**: Can't easily test event chains
5. **Race conditions**: Event listeners may not be registered when events fire
6. **Memory leaks**: Easy to forget cleanup in long event listener lists

**Impact:** Medium reliability risk, high maintainability cost

**Recommendation:**
Refactor to one of these architecturally sound patterns:

**Option A - Callback Registry (Preferred):**
```typescript
// lib/callbacks/schema-callback-registry.ts
type GetSchemaFieldOrderFn = (collectionName: string) => string[] | null

class SchemaCallbackRegistry {
  private callback: GetSchemaFieldOrderFn | null = null

  register(fn: GetSchemaFieldOrderFn) {
    this.callback = fn
  }

  getFieldOrder(collectionName: string): string[] | null {
    return this.callback?.(collectionName) ?? null
  }
}

export const schemaCallbackRegistry = new SchemaCallbackRegistry()
```

Layout.tsx registers the callback:
```typescript
useEffect(() => {
  schemaCallbackRegistry.register((collectionName) => {
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    return collections?.find(c => c.name === collectionName)?.schema?.fieldOrder ?? null
  })
}, [projectPath])
```

Store uses it synchronously:
```typescript
const schemaFieldOrder = schemaCallbackRegistry.getFieldOrder(currentFile.collection)
```

**Benefits:**
- Type-safe
- Synchronous (no polling)
- Testable
- Clear dependencies
- No memory leak risk

**Option B - Query Client Direct Access:**
If stores can import queryClient, just call `queryClient.getQueryData()` directly from the store. The "bridge pattern" may be over-engineered.

---

### 2. Custom YAML Parser in Rust is High-Risk

**Location:** `src-tauri/src/commands/files.rs:425-623`

**Problem:**
600+ lines of custom YAML parsing logic that handles nested objects, arrays, indentation, etc. This is **reinventing a solved problem** and introduces significant risk.

**Issues:**
1. **Edge cases**: YAML spec is complex (anchors, aliases, multi-line strings, etc.)
2. **Maintenance burden**: Every YAML edge case requires custom code
3. **Security**: Custom parsers often have subtle bugs that become vulnerabilities
4. **Testing overhead**: Need comprehensive tests for all YAML features
5. **Existing solution**: `serde_yaml` is battle-tested, maintained, and complete

**Impact:** Medium reliability risk, high maintenance burden

**Recommendation:**
Replace with `serde_yaml`:

```rust
// Cargo.toml
[dependencies]
serde_yaml = "0.9"

// files.rs
fn parse_yaml_to_json(yaml_str: &str) -> Result<HashMap<String, Value>, String> {
    serde_yaml::from_str(yaml_str)
        .map_err(|e| format!("YAML parse error: {e}"))
}

fn serialize_value_to_yaml(value: &Value) -> String {
    serde_yaml::to_string(value).unwrap_or_default()
}
```

**Benefits:**
- Delete 200+ lines of complex code
- Better error messages
- Handles all YAML edge cases
- Security audited
- Well-tested

**Counter-argument addressed:** "But we need custom formatting!" - Use serde_yaml for parsing, then implement minimal custom serialization if needed. You only need to handle the subset of YAML you generate, not parse.

---

### 3. Auto-Save Data Loss Risk

**Location:** `src/store/editorStore.ts:459-477`

**Problem:**
Current auto-save implementation clears and reschedules the timeout on every keystroke:

```typescript
scheduleAutoSave: () => {
  const store = get()

  // Clear existing timeout
  if (store.autoSaveTimeoutId) {
    clearTimeout(store.autoSaveTimeoutId)
  }

  const timeoutId = setTimeout(() => {
    void store.saveFile(false)
  }, autoSaveDelay * 1000)

  set({ autoSaveTimeoutId: timeoutId })
}
```

**Issues:**
1. **Continuous typing prevents save**: If user types for 10 minutes straight (e.g., during flow state), auto-save never fires
2. **No save queue**: If save fails, there's no retry mechanism
3. **Silent failures**: Failed auto-saves just log; user may not notice until data is lost
4. **No dirty state persistence**: If app crashes before auto-save fires, recent changes are lost

**Impact:** **HIGH reliability risk** - potential data loss

**Recommendation:**
Implement debounced save with fallback mechanisms:

```typescript
// lib/auto-save/debounced-save.ts
export class DebouncedSave {
  private timeoutId: number | null = null
  private lastSaveTime: number = 0
  private readonly maxDelay: number // Maximum time between saves

  constructor(
    private delay: number,
    private maxDelay: number = 10000 // Force save after 10s
  ) {}

  schedule(saveFn: () => Promise<void>) {
    const now = Date.now()
    const timeSinceLastSave = now - this.lastSaveTime

    // Force save if it's been too long
    if (timeSinceLastSave >= this.maxDelay) {
      this.executeSave(saveFn)
      return
    }

    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    // Schedule debounced save
    this.timeoutId = setTimeout(() => {
      this.executeSave(saveFn)
    }, this.delay)
  }

  private async executeSave(saveFn: () => Promise<void>) {
    this.lastSaveTime = Date.now()
    this.timeoutId = null

    try {
      await saveFn()
    } catch (error) {
      // Implement retry logic here
      console.error('Auto-save failed:', error)
    }
  }
}
```

**Additional improvements:**
- Add visual indicator when file is dirty
- Show toast when auto-save fails (not just success)
- Persist dirty state to localStorage as backup
- Add "unsaved changes" dialog on app close

---

### 4. Query Invalidation is Too Broad

**Location:** `src/store/projectStore.ts:384-408`

**Problem:**
When settings change, the code invalidates entire query branches:

```typescript
await queryClient.invalidateQueries({
  queryKey: [...queryKeys.all, projectPath, selectedCollection, 'directory'],
})
```

This invalidates **all directory queries** for the collection, including subdirectories, causing:
- Unnecessary network/filesystem operations
- UI flicker as data reloads
- Wasted CPU cycles

**Impact:** Medium performance impact, poor UX

**Recommendation:**
Use more granular invalidation:

```typescript
// Only invalidate what actually changed
if (settings.pathOverrides?.contentDirectory) {
  // Content directory changed - invalidate collections
  await queryClient.invalidateQueries({
    queryKey: queryKeys.collections(projectPath),
  })
}

if (settings.frontmatterMappings && currentFile) {
  // Only invalidate the current file's query
  await queryClient.invalidateQueries({
    queryKey: queryKeys.fileContent(projectPath, currentFile.id),
    exact: true, // Don't invalidate related queries
  })
}
```

**Alternative:** Use `setQueryData` for optimistic updates instead of invalidation when you know the new state.

---

### 5. File Watcher Race Conditions

**Location:** `src/store/editorStore.ts:356-398`

**Problem:**
The file watcher uses `recentlySavedFile` tracking with a 1-second timeout to prevent infinite loops. This has race condition risks:

```typescript
// Mark file as recently saved
set({ recentlySavedFile: currentFile.path })

await invoke('save_markdown_content', {...}) // Could take >1 second

// Clear after 1 second
setTimeout(() => {
  set({ recentlySavedFile: null })
}, 1000)
```

**Race condition scenario:**
1. User saves file
2. `recentlySavedFile` set to file path
3. Save operation takes 1.5 seconds (slow disk)
4. Timeout clears `recentlySavedFile` after 1 second
5. File watcher fires after save completes (at 1.5 seconds)
6. File is NOT in `recentlySavedFile` anymore
7. Query invalidates, triggers reload, potential save again → **infinite loop**

**Impact:** Medium reliability risk (rare but possible infinite loops)

**Recommendation:**
Use version-based tracking instead of time-based:

```typescript
interface EditorState {
  // Replace recentlySavedFile with:
  saveVersion: number  // Increment on each save
  lastWatchedVersion: number  // Last version we saw from file watcher
}

saveFile: async () => {
  const currentVersion = get().saveVersion + 1
  set({ saveVersion: currentVersion })

  await invoke('save_markdown_content', {
    // ... includes currentVersion
  })

  // In file watcher event handler:
  const { saveVersion, lastWatchedVersion } = get()
  if (event.version <= saveVersion) {
    // This is our own save, ignore
    return
  }
  // External change, invalidate
}
```

---

### 6. useLayoutEventListeners is a God Hook

**Location:** `src/hooks/useLayoutEventListeners.ts` (487 lines)

**Problem:**
This single hook manages:
- Keyboard shortcuts (14 different shortcuts)
- Tauri menu events (15+ listeners)
- DOM custom events (10+ custom events)
- Theme synchronization
- Focus mode management
- Settings updates
- File watcher initialization
- Toast bridge

**Issues:**
1. **Single Responsibility Principle violation**: One hook doing 10+ different things
2. **Hard to test**: Can't test keyboard shortcuts without testing menu events
3. **Hard to understand**: 487 lines of deeply nested useEffect calls
4. **Coupling**: Changes to shortcuts affect menu logic affect settings logic
5. **Performance**: Giant hook re-runs on any dependency change

**Impact:** High maintenance burden, medium performance impact

**Recommendation:**
Decompose into focused hooks:

```typescript
// hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  useHotkeys('mod+s', () => {...})
  useHotkeys('mod+1', () => {...})
  // etc.
}

// hooks/useMenuEvents.ts
export function useMenuEvents() {
  useEffect(() => {
    return setupMenuListeners() // Returns cleanup
  }, [])
}

// hooks/useThemeSync.ts
export function useThemeSync(globalSettings) {
  useEffect(() => {
    if (globalSettings?.general?.theme) {
      setTheme(globalSettings.general.theme)
    }
  }, [globalSettings?.general?.theme])
}

// hooks/useProjectInitialization.ts
export function useProjectInitialization() {
  useEffect(() => {
    void useProjectStore.getState().loadPersistedProject()
  }, [])
}

// Layout.tsx - compose the hooks
function Layout() {
  useKeyboardShortcuts()
  useMenuEvents()
  useThemeSync(globalSettings)
  useProjectInitialization()

  // ... rest of layout
}
```

**Benefits:**
- Each hook is testable in isolation
- Clear dependencies for each concern
- Can disable/enable features by commenting out hooks
- Easier to understand flow

---

### 7. Type Safety Gaps in Critical Paths

**Locations:** Throughout codebase

**Problem:**
Several critical communication paths lack type safety:

**A. Event Payloads:**
```typescript
// No type checking on event detail
window.dispatchEvent(new CustomEvent('file-opened', {
  detail: { collectionName: file.collection }
}))

// Consumer has no idea what shape detail should be
const handleFileOpened = (event: Event) => {
  const customEvent = event as CustomEvent<{ collectionName: string }>
  // Manual type assertion required
}
```

**B. Tauri Command Names:**
```typescript
// String literals - typos not caught until runtime
await invoke('save_markdown_content', {...})
// vs
await invoke('save_markdwn_content', {...}) // Typo!
```

**C. Query Keys:**
```typescript
// Good: Factory pattern
queryKeys.collections(projectPath)

// Missing: Mutations don't have the same type safety
const mutation = useMutation({
  mutationFn: async (file: FileEntry) => {
    // Mutation key is just a string array
  }
})
```

**Impact:** Medium reliability risk, high developer friction

**Recommendation:**

**A. Typed Event System:**
```typescript
// lib/events/types.ts
export interface AppEvents {
  'file-opened': { collectionName: string }
  'get-schema-field-order': { collectionName: string }
  'schema-field-order-response': { fieldOrder: string[] | null }
  // ... etc
}

// lib/events/typed-events.ts
export function dispatchAppEvent<K extends keyof AppEvents>(
  eventName: K,
  detail: AppEvents[K]
) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

export function listenAppEvent<K extends keyof AppEvents>(
  eventName: K,
  handler: (event: CustomEvent<AppEvents[K]>) => void
) {
  window.addEventListener(eventName, handler as EventListener)
  return () => window.removeEventListener(eventName, handler as EventListener)
}

// Usage - fully typed!
dispatchAppEvent('file-opened', { collectionName: 'blog' })

listenAppEvent('file-opened', (event) => {
  // event.detail.collectionName is typed as string
})
```

**B. Typed Tauri Commands:**
```typescript
// lib/tauri-commands.ts
import { invoke as tauriInvoke } from '@tauri-apps/api/core'

interface TauriCommands {
  save_markdown_content: {
    args: {
      filePath: string
      frontmatter: Record<string, unknown>
      content: string
      imports: string
      schemaFieldOrder: string[] | null
      projectRoot: string
    }
    returns: void
  }
  read_file: {
    args: { filePath: string; projectRoot: string }
    returns: string
  }
  // ... all commands
}

export async function invoke<K extends keyof TauriCommands>(
  command: K,
  args: TauriCommands[K]['args']
): Promise<TauriCommands[K]['returns']> {
  return tauriInvoke(command, args)
}

// Usage - fully typed and autocompleted!
await invoke('save_markdown_content', {
  filePath: '...',
  // TypeScript enforces all required args
})

// Typo is caught at compile time:
await invoke('save_markdwn_content', {...}) // ❌ Type error!
```

---

## Moderate Issues

### 8. No Recovery UI for Crash Reports

**Location:** `src/lib/recovery/`, `src-tauri/src/commands/files.rs:790-852`

**Problem:**
The app diligently saves recovery data and crash reports, but there's no UI to:
- Show users that recovery data exists
- Let users recover from a crash
- View crash reports
- Clear old recovery files

**Impact:** Low reliability (data is saved), high UX gap

**Recommendation:**
Add a recovery dialog that appears on app launch if recovery data exists:

```typescript
// components/recovery/RecoveryDialog.tsx
export function RecoveryDialog() {
  const [recoveryFiles, setRecoveryFiles] = useState([])

  useEffect(() => {
    void checkForRecoveryData()
  }, [])

  async function checkForRecoveryData() {
    const files = await invoke('list_recovery_files')
    if (files.length > 0) {
      setRecoveryFiles(files)
    }
  }

  return (
    <Dialog open={recoveryFiles.length > 0}>
      <DialogContent>
        <DialogTitle>Unsaved Changes Found</DialogTitle>
        <DialogDescription>
          We found {recoveryFiles.length} file(s) with unsaved changes.
          Would you like to recover them?
        </DialogDescription>
        {/* List recovery files with preview and restore buttons */}
      </DialogContent>
    </Dialog>
  )
}
```

---

### 9. Testing Coverage is Insufficient

**Statistics:**
- 208 TypeScript files
- 26 test files (~12.5% file coverage)
- **Critical untested paths:**
  - Store interactions with TanStack Query
  - Event bridge communication
  - File save/load cycle
  - Query invalidation logic
  - Auto-save mechanisms

**Problem:**
While core editor logic has good tests, the **integration points** between systems are untested. These are where bugs actually occur.

**Impact:** High risk of regressions, high debugging time

**Recommendation:**
Prioritize integration tests for critical paths:

```typescript
// tests/integration/file-save-cycle.test.ts
describe('File save cycle', () => {
  it('should save file, invalidate queries, and update UI', async () => {
    // 1. Setup project and open file
    const { result } = renderHook(() => useProjectStore())
    await act(() => result.current.setProject('/test/project'))

    // 2. Make changes
    const editor = renderHook(() => useEditorStore())
    act(() => editor.current.setEditorContent('New content'))

    // 3. Save file
    await act(() => editor.current.saveFile())

    // 4. Verify query was invalidated
    expect(queryClient.getQueryState(['file-content', ...])).toBe('invalidated')

    // 5. Verify file watcher was notified
    // 6. Verify recentlySavedFile logic
  })
})

// tests/integration/event-communication.test.ts
describe('Event bridge communication', () => {
  it('should communicate schema field order via events', async () => {
    // Test the full event chain
  })
})
```

**Testing strategy:**
1. Integration tests for critical paths (20 tests)
2. Unit tests for business logic (existing coverage is good)
3. E2E tests for user workflows (5 key workflows)

---

### 10. Bundle Size and Code Splitting

**Location:** `package.json`, Vite configuration

**Problem:**
- `compromise` package is 14MB (for copyedit mode feature)
- No visible code splitting
- All editor modes loaded upfront even if never used

**Impact:** Medium performance (initial load time)

**Recommendation:**
Implement lazy loading for heavy features:

```typescript
// Use React.lazy for heavy features
const CopyeditMode = React.lazy(() => import('./editor/extensions/copyedit-mode'))

// Only load compromise when entering copyedit mode
async function enableCopyeditMode() {
  const { updateCopyeditModePartsOfSpeech } = await import(
    /* webpackChunkName: "copyedit" */
    './lib/editor/extensions/copyedit-mode'
  )
  updateCopyeditModePartsOfSpeech()
}
```

**Benefits:**
- Faster initial load
- Smaller main bundle
- Features load on-demand

---

### 11. Store Access Patterns are Inconsistent

**Locations:** Throughout codebase

**Problem:**
Three different patterns for accessing Zustand stores:

```typescript
// Pattern 1: Hook with selector (causes re-renders)
const currentFile = useEditorStore(state => state.currentFile)

// Pattern 2: getState() in callbacks (performance optimized)
const { currentFile } = useEditorStore.getState()

// Pattern 3: Direct destructuring in hooks
const { currentFile, isDirty, saveFile } = useEditorStore()
```

**Issue:** Developers don't know which pattern to use when. Pattern 3 causes unnecessary re-renders but is most common in new code.

**Impact:** Medium performance impact, high developer confusion

**Recommendation:**
Document and enforce patterns with ESLint rules:

```javascript
// .eslintrc.js
rules: {
  'no-restricted-syntax': [
    'error',
    {
      // Disallow destructuring stores in component body
      selector: 'VariableDeclarator[init.callee.name=/useStore$/] > ObjectPattern',
      message: 'Do not destructure Zustand stores in component body. Use selectors or getState() in callbacks.'
    }
  ]
}
```

**Clear guidelines:**
```typescript
// ✅ GOOD: Selector for data you need to render
const currentFile = useEditorStore(state => state.currentFile)

// ✅ GOOD: getState() in callbacks (no re-renders)
const handleSave = useCallback(() => {
  const { currentFile, saveFile } = useEditorStore.getState()
  if (currentFile) void saveFile()
}, [])

// ❌ BAD: Destructuring causes re-renders on ANY store change
const { currentFile, isDirty, saveFile } = useEditorStore()
```

---

### 12. Path Validation Code is Duplicated

**Location:** `src-tauri/src/commands/files.rs`

**Problem:**
`validate_project_path` and `validate_app_data_path` are nearly identical functions with slight variations. DRY violation.

**Impact:** Low (maintenance burden)

**Recommendation:**
Extract common logic:

```rust
fn validate_path_within_bounds(
    file_path: &str,
    root_dir: &str,
    error_context: &str,
) -> Result<PathBuf, String> {
    let file_path = Path::new(file_path);
    let root_dir = Path::new(root_dir);

    // Common validation logic
    let canonical_file = canonicalize_with_parent_fallback(file_path)?;
    let canonical_root = root_dir
        .canonicalize()
        .map_err(|_| format!("Invalid {error_context}"))?;

    canonical_file
        .strip_prefix(&canonical_root)
        .map_err(|_| format!("File outside {error_context}"))?;

    Ok(canonical_file)
}

fn validate_project_path(file_path: &str, project_root: &str) -> Result<PathBuf, String> {
    validate_path_within_bounds(file_path, project_root, "project directory")
}

fn validate_app_data_path(file_path: &str, app_data_dir: &str) -> Result<PathBuf, String> {
    // Ensure app data dir exists
    std::fs::create_dir_all(app_data_dir).ok();
    validate_path_within_bounds(file_path, app_data_dir, "app data directory")
}
```

---

## Minor Issues

### 13. Frontmatter Undo/Redo Gap

**Problem:** CodeMirror has undo/redo for content, but frontmatter field changes have no undo capability.

**Recommendation:** Implement undo/redo for frontmatter using a simple history stack in editorStore.

---

### 14. Direct Store Pattern Documentation Misframes the Issue

**Location:** `CLAUDE.md`

**Problem:** Docs say "React Hook Form causes infinite loops, use Direct Store Pattern." But the real issue is:
- Mixing controlled components with external state management
- The architecture's event-driven communication adds complexity

**Recommendation:** Update documentation to explain the actual architectural trade-offs and when to use each pattern.

---

## Positive Observations

Before closing, it's worth noting the codebase's strengths:

1. **Excellent documentation** - Architecture guide is comprehensive
2. **Clear separation of concerns** - Decomposed stores prevent common Zustand issues
3. **Security-conscious** - Path validation and prototype pollution protection
4. **TanStack Query usage** - Proper query key factories and cache management
5. **Performance patterns** - `getState()` pattern is correct (just inconsistently applied)
6. **Strong type safety** - Strict TypeScript mode with `noUncheckedIndexedAccess`

These foundations make the codebase a good candidate for the refactoring recommended above.

---

## Prioritization

**Critical (Fix within 1-2 sprints):**
1. Auto-save data loss risk (#3)
2. File watcher race conditions (#5)
3. Event-driven bridge pattern (#1) - at least fix the polling

**High Priority (Fix within 1 month):**
4. Testing coverage gaps (#9)
5. Custom YAML parser replacement (#2)
6. God hook decomposition (#6)

**Medium Priority (Plan for next quarter):**
7. Type safety gaps (#7)
8. Query invalidation optimization (#4)
9. Recovery UI (#8)
10. Bundle size optimization (#10)

**Low Priority (Nice to have):**
11. Store access pattern consistency (#11)
12. Path validation DRY (#12)
13. Frontmatter undo/redo (#13)

---

## Conclusion

Astro Editor has a solid architectural foundation, but several patterns have evolved in ways that will increasingly impact reliability and maintainability. The most critical issues involve data integrity (auto-save, file watcher races) and maintainability (event communication complexity, testing gaps).

The good news: All identified issues have clear, implementable solutions. The architecture's strong foundations (decomposed state, query management, type safety) make these refactorings straightforward rather than requiring ground-up rewrites.

**Recommended next step:** Create engineering tickets for the Critical and High Priority items, estimate the work, and plan implementation over the next 2-3 months. The Low Priority items can be addressed opportunistically as you work in those areas.
