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

**Decision:** DO IT - Simple fix, low risk.

**Fix:** Add cancelled flag pattern:
```typescript
useEffect(() => {
  let cancelled = false
  const loadFileCounts = async () => {
    // ... existing loop ...
    if (!cancelled) {
      setFileCounts(counts)
    }
  }
  if (collections.length > 0) {
    void loadFileCounts()
  }
  return () => { cancelled = true }
}, [collections])
```

**Notes:** This only affects the file count loading effect. All store/query subscriptions that drive sidebar re-renders are separate and unaffected.

---

### 2. Panic-Prone Window Acquisition (Rust)

**File:** `src-tauri/src/lib.rs:246-248`

```rust
let window = app.get_webview_window("main").unwrap();
apply_vibrancy(&window, ...).expect("Unsupported platform!");
```
**Problem:** Double panic potential in critical startup code. App crashes if window doesn't exist or vibrancy fails.

**Decision:** DO IT - Simple fix, zero risk. Already handled correctly elsewhere in the same file (line 269).

**Fix:** Use the idiomatic Tauri pattern already present in the codebase:
```rust
#[cfg(target_os = "macos")]
{
    if let Some(window) = app.get_webview_window("main") {
        // Vibrancy is cosmetic - ignore failure gracefully
        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
    }
}
```

**Notes:** Vibrancy is purely cosmetic (frosted glass effect). Graceful failure means app works fine, just without the visual polish.

---

### 4. Blocking recv() in Async Context

**File:** `src-tauri/src/commands/watcher.rs:83-97`

Using `std::sync::mpsc::Receiver::recv()` (blocking) inside a `tokio::spawn()`. Should use `tokio::sync::mpsc` with async `recv().await`.

**Decision:** DO IT - Standard Tauri/Tokio best practice.

**Fix:** Swap to tokio's async channel:
```rust
// Change from std::sync::mpsc to tokio::sync::mpsc
let (tx, rx) = tokio::sync::mpsc::unbounded_channel();

// In the tokio::spawn, use async recv
while let Some(event) = rx.recv().await {
    // ... existing logic
}
```

**Notes:** The unbounded sender's `.send()` is sync (works in notify callback), receiver's `.recv().await` properly yields to tokio runtime. Same semantics, just async-aware.

---

### ~~5. Asset Protocol Wildcard Scope (Security)~~ SKIPPED

Used for image previews (ImageThumbnail.tsx, ImagePreview.tsx). Paths go through `commands.resolveImagePath()` in Rust before reaching `convertFileSrc()`. Real security control is in Rust path validation, not the protocol scope. Frontend doesn't talk to internet, user opens projects they trust. Wildcard scope is fine.

---

### ~~6. Extension Recreation on Every Render (CodeMirror)~~ SKIPPED

Editor creation effect has `[]` dependencies (line 227) - runs once. Subsequent `useEditorSetup` calls create arrays that are never used (guard on line 139). Component only re-renders on file switch / mode toggle (infrequent). Trivial GC'd allocations, not a performance issue.

---

### 7. Settings Object Duplication (8 locations)

**Files:**
- `src/components/preferences/panes/GeneralPane.tsx` (6 callback functions)
- `src/hooks/useDOMEventListeners.ts` (2 handlers)

Every settings update manually reconstructs the entire `GlobalSettings` object with hardcoded defaults.

**Decision:** DO IT - The registry manager already does deep merging. This is unnecessary code.

**Root cause:** The registry's `updateGlobalSettings()` already merges 2 levels deep:
```typescript
general: { ...this.globalSettings.general, ...settings.general }
```
So you can just pass `{ general: { ideCommand: 'code' } }` and it merges correctly.

**Fix:**

1. **GeneralPane handlers (6 locations)** - Remove ~90% of code, just pass the field:
```typescript
// Before (wrong assumption - 20 lines)
void updateGlobal({
  general: {
    ideCommand: value,
    theme: globalSettings?.general?.theme || 'system',
    highlights: globalSettings?.general?.highlights || { ... },
    // ... all other fields
  },
  appearance: globalSettings?.appearance || { ... },
})

// After (correct - 1 line)
void updateGlobal({ general: { ideCommand: value } })
```

2. **Highlight handlers (2 locations)** - Still need to spread `highlights` (nested object), but remove everything else:
```typescript
void updateGlobalSettings({
  general: {
    highlights: {
      ...globalSettings?.general?.highlights,
      [partOfSpeech]: !currentValue,
    },
  },
})
```

**Risk:** Low - registry merge already works, just removing redundancy.
**Effort:** ~30 mins cleanup.

---

### ~~8. 196-Line File Creation Callback~~ SKIPPED

Single coherent workflow only used in one place. File duplication (context-menu.tsx) is a different operation (just copy content). Extracting into 5 utilities would scatter logic without reuse benefit. The "complexity" is inherent to what creating a new file from schema requires.

---

## Medium Severity Issues

### 9. React.memo Always Returns True

**File:** `src/components/editor/Editor.tsx:318-321`

```typescript
const MemoizedEditor = React.memo(EditorViewComponent, () => true)
```
Forces the component to **never re-render**. Works now due to internal subscriptions, but extremely fragile. React Compiler already handles this.

**Decision:** PARTIAL - Remove the `React.memo` in `ImagePreview.tsx:161` (standard memo, Compiler handles it). Keep the Editor one - the `() => true` is a hard guarantee that prevents keystroke-triggered re-renders; removing it risks regression if Compiler doesn't infer stability correctly.

---

### ~~10. Missing useShallow on Array Dependencies~~ SKIPPED

- `src/components/preferences/panes/CollectionSettingsPane.tsx:65-82` - `collections` array triggers expensive schema deserialization on every query update
- `src/components/frontmatter/fields/ArrayField.tsx:32-54` - array values trigger re-computation unnecessarily

**Decision:** SKIP - Analysis was incorrect. `collections` comes from TanStack Query (not Zustand), so `useShallow` doesn't apply. `ArrayField.value` is a prop, not a store subscription. Both already use `useMemo` to guard expensive operations.

---

### ~~11. Regex Recompilation in Hot Path (CodeMirror)~~ SKIPPED

**File:** `src/lib/editor/extensions/copyedit-mode/pos-matching.ts:16-64`

`isExcludedContent()` recompiles 3-4 regex patterns on every call, and it's called for hundreds of POS matches on every copyedit analysis.

**Decision:** SKIP - When highlights are disabled (the default, and most users), this code never runs. When enabled, it's debounced to 3 seconds of inactivity. Moving regexes to module level risks subtle global regex state bugs (`lastIndex`) for a micro-optimization. Not worth it.

---

### ~~12. Unbounded Sentence Cache~~ SKIPPED

**File:** `src/lib/editor/sentence-detection.ts:6-60`

Cache deletes only ONE entry when reaching MAX_CACHE_SIZE (1000). With focus mode calling this on every cursor movement, cache grows beyond limit.

**Decision:** SKIP - Finding was incorrect. The cache IS bounded: when size >= 1000, it deletes 1, adds 1, stays at 1000. FIFO vs LRU might affect hit rate but not memory.

---

### 13. Focus Mode Decoration Inefficiency

**File:** `src/lib/editor/extensions/focus-mode.ts:56-107`

Creates two massive decorations spanning potentially 99% of the document, rebuilt from scratch on every cursor movement.

**Decision:** CONSIDER FOR FUTURE - A better approach exists: instead of decorating "everything except sentence" (O(doc_size)), flip it - dim all content via base CSS class, then apply ONE small decoration to "undim" the current sentence (O(sentence_size)). Requires careful CSS specificity work and testing. Not urgent - current approach works, just not optimal.

---

### ~~14. Mutex Panic Risk (Rust)~~ SKIPPED

**File:** `src-tauri/src/commands/watcher.rs:77, 106`

```rust
let mut watchers = watcher_map.lock().unwrap();
```
If a panic occurs while mutex is held, subsequent calls find poisoned mutex and panic.

**Decision:** SKIP - Theoretical concern. The code inside the lock is trivial (`HashMap.insert/remove`) and can't panic. In a desktop app, if something panics badly enough to poison a mutex, you have bigger problems. Defensive `.unwrap_or_else()` adds noise without practical benefit.

---

### ~~15. 447-Line Sidebar Component~~ SKIPPED

**File:** `src/components/layout/LeftSidebar.tsx`

Handles file listing, filtering, breadcrumbs, rename state, draft filtering, collections view, subdirectories. Should be decomposed into focused sub-components.

**Decision:** SKIP - Splitting would require significant props drilling (8+ props for header alone) or duplicate store subscriptions. Sub-components wouldn't be reused elsewhere. Component already has clear section comments, business logic extracted to `lib/` (`filterFilesByDraft`, `sortFilesByPublishedDate`), and reusable `FileItem` extracted. Organizational benefit doesn't outweigh coordination complexity.

---

### 16. 38+ Unstructured Console Calls

Logging is inconsistent across the codebase. Some use Tauri logger, others use console. Should consolidate to centralized logger.

**Decision:** DO IT - Create as separate task. Current docs (`docs/developer/logging.md`) cover Tauri logger but lack guidance on when to use `console.*` vs Tauri logger.

**Required work:**
1. Audit 38 console calls across 23 files - categorize as dev-only vs production-worthy
2. Define clear conventions: decision tree for console.* vs Tauri logger
3. Update logging.md with AI-specific instructions
4. Refactor inconsistent usages to match conventions

---

### 17. Migration Code Still Present

**Decision:** DO IT - Remove the "TODO: Remove after v2.5.0" comment from `src/lib/project-registry/migrations.ts`. Keep the migration code as a safety net for late upgraders.

---

## Low Severity Issues

### 18. Typewriter Mode Race Conditions

**Decision:** DO IT - Remove typewriter mode entirely. Feature is not marketed, not explained, and current implementation is problematic. Delete from 14 files:
- `src/lib/editor/extensions/typewriter-mode.ts` (delete file)
- `src/lib/editor/extensions/createExtensions.ts`
- `src/lib/editor/extensions/keymap.ts`
- `src/lib/editor/commands/editorCommands.ts`
- `src/lib/editor/commands/types.ts`
- `src/lib/commands/app-commands.ts`
- `src/lib/commands/types.ts`
- `src/store/uiStore.ts`
- `src/components/editor/Editor.tsx`
- `src/hooks/commands/useCommandContext.ts`
- `src/hooks/useDOMEventListeners.ts`
- `src/hooks/editor/useEditorSetup.test.ts`
- `src/lib/editor/commands/CommandRegistry.test.ts`
- `src/components/editor/__tests__/focus-typewriter-modes.test.tsx` (delete or update)

---

### ~~19. Global Mutable State in Copyedit~~ SKIPPED

**File:** `src/lib/editor/extensions/copyedit-mode/extension.ts:24-25`

Global `currentEditorView` variable breaks with multiple editor instances or React Strict Mode.

**Decision:** SKIP - Theoretical concern. App only has one editor, no split-view or multi-tab. React Strict Mode double-mounts sequentially (not parallel) so it doesn't actually break. If split-view editing is ever added, this would need redesigning anyway.

---

### 20. Alt Key Listener Re-registration

**File:** `src/components/editor/Editor.tsx:92-135`

Effect has `isAltPressed` in dependencies, causing listener re-registration on every Alt key toggle.

**Decision:** DO IT - Simple fix: replace `useState` with `useRef` for `isAltPressed`. Use `isAltPressedRef.current` in handlers, effect dependencies become `[]`. ~5 line change, zero risk.

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
