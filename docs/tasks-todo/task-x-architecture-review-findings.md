# Architecture Review Findings

Expert review of Tauri/React codebase for performance, maintainability, and unnecessary complexity.

---

## Quick Fixes

### 1. Memory Leak in LeftSidebar.tsx

**File:** `src/components/layout/LeftSidebar.tsx:88-113`

Async effect lacks cleanup - if component unmounts during `loadFileCounts()`, it updates unmounted state.

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

---

### 2. Panic-Prone Window Acquisition (Rust)

**File:** `src-tauri/src/lib.rs:246-248`

Double panic potential in startup code. App crashes if window doesn't exist or vibrancy fails.

**Fix:** Use idiomatic pattern already present elsewhere in the file:
```rust
#[cfg(target_os = "macos")]
{
    if let Some(window) = app.get_webview_window("main") {
        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
    }
}
```

---

### 3. Blocking recv() in Async Context (Rust)

**File:** `src-tauri/src/commands/watcher.rs:83-97`

Using `std::sync::mpsc::Receiver::recv()` (blocking) inside `tokio::spawn()`.

**Fix:** Swap to tokio's async channel:
```rust
let (tx, rx) = tokio::sync::mpsc::unbounded_channel();

while let Some(event) = rx.recv().await {
    // ... existing logic
}
```

---

### 4. Alt Key Listener Re-registration

**File:** `src/components/editor/Editor.tsx:92-135`

Effect has `isAltPressed` in dependencies, causing listener re-registration on every Alt key toggle.

**Fix:** Replace `useState` with `useRef` for `isAltPressed`. Use `isAltPressedRef.current` in handlers, effect dependencies become `[]`. ~5 line change.

---

### 5. Remove Migration TODO Comment

**File:** `src/lib/project-registry/migrations.ts`

Remove the "TODO: Remove after v2.5.0" comment. Keep the migration code as a safety net for late upgraders.

---

### 6. Remove Redundant React.memo

**File:** `src/components/editor/ImagePreview.tsx:161`

Remove `React.memo(ImagePreviewComponent)` - React Compiler handles this automatically.

Note: Keep the `React.memo(() => true)` in Editor.tsx - that's a hard guarantee preventing keystroke-triggered re-renders.

---

## Cleanup Tasks

### 7. Settings Object Duplication

**Files:**
- `src/components/preferences/panes/GeneralPane.tsx` (6 callbacks)
- `src/hooks/useDOMEventListeners.ts` (2 handlers)

Every settings update manually reconstructs the entire `GlobalSettings` object. The registry already does deep merging, so this is unnecessary.

**Fix:** Simplify all handlers to pass only the changed field:
```typescript
// Before (20 lines)
void updateGlobal({
  general: {
    ideCommand: value,
    theme: globalSettings?.general?.theme || 'system',
    // ... all other fields
  },
  appearance: globalSettings?.appearance || { ... },
})

// After (1 line)
void updateGlobal({ general: { ideCommand: value } })
```

For highlight toggles, still spread the `highlights` object (nested), but remove everything else.

---

### 8. Consolidate Logging

38 console calls across 23 files with no clear conventions.

**Required work:**
1. Audit 38 console calls - categorize as dev-only vs production-worthy
2. Define clear conventions: decision tree for `console.*` vs Tauri logger
3. Update `docs/developer/logging.md` with AI-specific instructions
4. Refactor inconsistent usages to match conventions

---

## Removal Tasks

### 9. Remove Typewriter Mode

Feature is not marketed, not explained, and implementation is problematic. Delete entirely from 14 files:

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

## Future Considerations

### Focus Mode Decoration Inefficiency

**File:** `src/lib/editor/extensions/focus-mode.ts:56-107`

Currently creates two massive decorations spanning 99% of the document, rebuilt on every cursor movement (O(doc_size)).

**Better approach:** Dim all content via base CSS class, apply ONE small decoration to "undim" the current sentence (O(sentence_size)). Requires careful CSS specificity work and testing. Not urgent - current approach works.
