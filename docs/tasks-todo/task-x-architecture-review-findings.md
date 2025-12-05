# Architecture Review Findings

## Original Prompt

> I want you to review this entire code base as an expert in architecture and great coding when it comes to Tauri/React apps. We have recently done a lot of work to clean up this code base from an architectural and "clean code" point of view. I want you to conduct a full review of all of this code base as an expert and reccomend any changes, paying particular attention to any likeley sources of performance problems or long-term maintainance problems, or code which is overly complex/doesn't need to be here. Use subagents as much as you need. Ultrathink. Do not read files in `docs/tasks-done/` at all. Do not provide any feedback on things which are already good. I only care about opportunities for improvement. And I care primarily about important opportunities for improvement, not tiny trivial refactorings that are just nitpicks. If you find nothing to report, just tell me that. But anything you do find that you think could be improved, please tell me what it is. Your current knowledge and the information in @docs/developer/ may well be enough for you to do this job properly, but you may use specialist agents or internet searches if you feel it necessary. Take all the time you need.

## Review Methodology

Used five specialized agents in parallel:
- **react-performance-architect**: React components, state management, performance patterns
- **Explore agent**: Rust backend architectural issues
- **security-auditor**: Security vulnerabilities
- **code-refactorer**: Complexity and duplication
- **codemirror-6-specialist**: CodeMirror integration

---

## Critical/High Severity Issues

### 1. Memory Leak Potential in LeftSidebar.tsx

**File:** `src/components/layout/LeftSidebar.tsx:88-113`

The `collections` array dependency in useEffect lacks proper cleanup:
```typescript
useEffect(() => {
  const loadFileCounts = async () => { /* async operations */ }
  if (collections.length > 0) {
    void loadFileCounts()
  }
}, [collections])  // Array gets new reference on every query update
```
**Problem:** No cleanup for in-flight async operations. If component unmounts during `loadFileCounts()`, `setFileCounts()` updates unmounted state.

---

### 2. Panic-Prone Window Acquisition (Rust)

**File:** `src-tauri/src/lib.rs:246-248`

```rust
let window = app.get_webview_window("main").unwrap();
apply_vibrancy(&window, ...).expect("Unsupported platform!");
```
**Problem:** Double panic potential in critical startup code. App crashes if window doesn't exist or vibrancy fails.

---

### 3. Unbounded Event Buffer in File Watcher

**File:** `src-tauri/src/commands/watcher.rs:84-97`

```rust
while let Ok(event) = rx.recv() {
    event_buffer.push(event);  // No size limit
    if last_event_time.elapsed() > Duration::from_millis(500) { ... }
}
```
**Problem:** Buffer grows indefinitely during rapid file changes. Large file operations could consume significant memory.

---

### 4. Blocking recv() in Async Context

**File:** `src-tauri/src/commands/watcher.rs:83-97`

Using `std::sync::mpsc::Receiver::recv()` (blocking) inside a `tokio::spawn()`. Should use `tokio::sync::mpsc` with async `recv().await`.

---

### 5. Asset Protocol Wildcard Scope (Security)

**File:** `src-tauri/tauri.conf.json:34-39`

```json
"assetProtocol": { "scope": ["**"] }
```
**Problem:** Allows frontend to access any file via `asset://` protocol. A malicious project could expose sensitive files like `~/.ssh/id_rsa` through crafted image paths.

**Recommendation:** Restrict to specific directories like `"$HOME/Documents/**"`.

---

### 6. Extension Recreation on Every Render (CodeMirror)

**File:** `src/hooks/editor/useEditorSetup.ts:20-25`

Extensions (keymaps, themes, focus mode, etc.) are created fresh on every call to `useEditorSetup()`. These complex objects should be created once and reused.

---

### 7. Settings Object Duplication (14 locations)

**Files:**
- `src/components/preferences/panes/GeneralPane.tsx` (6 callback functions)
- `src/hooks/useDOMEventListeners.ts` (2 handlers)

Every settings update manually reconstructs the entire `GlobalSettings` object with hardcoded defaults. Adding a new setting requires updating 14 locations.

**Example (repeated 14 times):**
```typescript
void updateGlobal({
  general: {
    ideCommand: globalSettings?.general?.ideCommand || '',
    theme: globalSettings?.general?.theme || 'system',
    // ... 15+ more fields
  }
})
```

---

### 8. 196-Line File Creation Callback

**File:** `src/hooks/useCreateFile.ts:74-270`

Single function handles: concurrency guards, collection validation, path resolution, collision detection, schema parsing, YAML serialization, file mutation, focus management. Impossible to test individual pieces.

---

## Medium Severity Issues

### 9. React.memo Always Returns True

**File:** `src/components/editor/Editor.tsx:318-321`

```typescript
const MemoizedEditor = React.memo(EditorViewComponent, () => true)
```
Forces the component to **never re-render**. Works now due to internal subscriptions, but extremely fragile. React Compiler already handles this.

---

### 10. Missing useShallow on Array Dependencies

- `src/components/preferences/panes/CollectionSettingsPane.tsx:65-82` - `collections` array triggers expensive schema deserialization on every query update
- `src/components/frontmatter/fields/ArrayField.tsx:32-54` - array values trigger re-computation unnecessarily

---

### 11. Regex Recompilation in Hot Path (CodeMirror)

**File:** `src/lib/editor/extensions/copyedit-mode/pos-matching.ts:16-64`

`isExcludedContent()` recompiles 3-4 regex patterns on every call, and it's called for hundreds of POS matches on every copyedit analysis.

---

### 12. Unbounded Sentence Cache

**File:** `src/lib/editor/sentence-detection.ts:6-60`

Cache deletes only ONE entry when reaching MAX_CACHE_SIZE (1000). With focus mode calling this on every cursor movement, cache grows beyond limit.

---

### 13. Focus Mode Decoration Inefficiency

**File:** `src/lib/editor/extensions/focus-mode.ts:56-107`

Creates two massive decorations spanning potentially 99% of the document, rebuilt from scratch on every cursor movement.

---

### 14. Mutex Panic Risk (Rust)

**File:** `src-tauri/src/commands/watcher.rs:77, 106`

```rust
let mut watchers = watcher_map.lock().unwrap();
```
If a panic occurs while mutex is held, subsequent calls find poisoned mutex and panic.

---

### 15. 447-Line Sidebar Component

**File:** `src/components/layout/LeftSidebar.tsx`

Handles file listing, filtering, breadcrumbs, rename state, draft filtering, collections view, subdirectories. Should be decomposed into focused sub-components.

---

### 16. 38+ Unstructured Console Calls

Logging is inconsistent across the codebase. Some use Tauri logger, others use console. Should consolidate to centralized logger.

---

### 17. Migration Code Still Present

**File:** `src/lib/project-registry/migrations.ts`

TODO comment says "Remove after v2.5.0" - scheduled deletion not executed.

---

## Low Severity Issues

### 18. Typewriter Mode Race Conditions

**File:** `src/lib/editor/extensions/typewriter-mode.ts:28-54`

Multiple `setTimeout(..., 0)` callbacks queue during rapid cursor movements with no cancellation.

---

### 19. Global Mutable State in Copyedit

**File:** `src/lib/editor/extensions/copyedit-mode/extension.ts:24-25`

Global `currentEditorView` variable breaks with multiple editor instances or React Strict Mode.

---

### 20. Alt Key Listener Re-registration

**File:** `src/components/editor/Editor.tsx:92-135`

Effect has `isAltPressed` in dependencies, causing listener re-registration on every Alt key toggle.

---

## Security Summary

**Overall Security Posture: GOOD** - Strong path traversal protection, allowlist-based IDE commands, proper Rust Command API usage. Only findings:

| Severity | Finding |
|----------|---------|
| Medium | Asset protocol wildcard scope |
| Medium | TOCTOU in file copy (mitigated by atomic `create_new`) |
| Low | CSP allows `unsafe-inline` for styles |
| Low | Telemetry UUID without consent dialog |

---

## Recommendations by Priority

### Immediate (High ROI, Low Risk)
1. **Create settings merger utility** - Eliminates 14 maintenance points, ~180 lines of duplication
2. **Restrict asset protocol scope** in tauri.conf.json
3. **Replace `.unwrap()` calls** in Rust startup code with proper error handling
4. **Add cleanup to LeftSidebar effect** with cancelled flag pattern

### Short-Term
5. **Memoize CodeMirror extension creation** - create once, reuse
6. **Decompose useCreateFile** into focused utilities
7. **Add useShallow** to array dependencies in CollectionSettingsPane
8. **Remove React.memo with always-true comparison** from Editor.tsx

### Medium-Term
9. **Extract LeftSidebar sub-components** (CollectionsList, FilesList, Breadcrumbs)
10. **Optimize copyedit mode** - compile regexes once, use incremental updates
11. **Fix sentence cache eviction** - delete more than one entry
12. **Consolidate logging** to centralized logger
13. **Clean up migrations.ts** if users have upgraded

---

## What's Working Well

- Zustand selector syntax used correctly throughout
- getState() pattern in callbacks prevents re-render cascades
- useShallow for objects in critical paths
- Direct Store Pattern for forms
- No hooks in lib/ - architectural boundary maintained
- Comprehensive path traversal protection in Rust
- Query keys factory pattern
- Good test coverage for business logic

---

## Summary

The codebase is **well-architected overall** with solid patterns in place. The cleanup work has clearly been effective - the state management, command system, and React patterns follow best practices.

The **highest-impact issues** to address are:
1. **Settings duplication** (14 locations, easy fix with merger utility)
2. **Asset protocol scope** (security concern, simple config change)
3. **Rust panic points** (startup stability)
4. **CodeMirror extension recreation** (memory/performance)
5. **useCreateFile complexity** (196 lines -> 5 testable utilities)

Most other findings are incremental improvements rather than critical problems. The architecture is sound, and the documented patterns are being followed correctly throughout most of the codebase.

---

## Discussion Notes

_Space for comments and decisions on each finding._
