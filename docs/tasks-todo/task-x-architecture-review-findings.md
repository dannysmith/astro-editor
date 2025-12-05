# Architecture Review Implementation Plan

Expert review of Tauri/React codebase for performance, maintainability, and unnecessary complexity.

---

## Overview

This document contains actionable implementation details for 9 tasks identified during architecture review. Tasks are ordered by complexity and dependency.

**Execution Order:**
1. Quick Fixes (1-6): Independent, can be done in any order
2. Settings Object Duplication (7): Standalone cleanup
3. Consolidate Logging (8): Requires audit and documentation update
4. Remove Typewriter Mode (9): Multi-file removal, do last

---

## Quick Fixes

### 1. Memory Leak in LeftSidebar.tsx

**File:** `src/components/layout/LeftSidebar.tsx`

**Problem:** Async effect at lines 88-113 lacks cleanup. If the component unmounts during `loadFileCounts()`, it updates unmounted state.

**Current Code (lines 88-113):**
```typescript
useEffect(() => {
  const loadFileCounts = async () => {
    const counts: Record<string, number> = {}

    for (const collection of collections) {
      try {
        const result = await commands.countCollectionFilesRecursive(
          collection.path
        )
        if (result.status === 'error') {
          counts[collection.name] = 0
        } else {
          counts[collection.name] = result.data
        }
      } catch {
        counts[collection.name] = 0
      }
    }

    setFileCounts(counts)
  }

  if (collections.length > 0) {
    void loadFileCounts()
  }
}, [collections])
```

**Fix:** Add cancelled flag pattern:
```typescript
useEffect(() => {
  let cancelled = false

  const loadFileCounts = async () => {
    const counts: Record<string, number> = {}

    for (const collection of collections) {
      try {
        const result = await commands.countCollectionFilesRecursive(
          collection.path
        )
        if (result.status === 'error') {
          counts[collection.name] = 0
        } else {
          counts[collection.name] = result.data
        }
      } catch {
        counts[collection.name] = 0
      }
    }

    if (!cancelled) {
      setFileCounts(counts)
    }
  }

  if (collections.length > 0) {
    void loadFileCounts()
  }

  return () => {
    cancelled = true
  }
}, [collections])
```

**Testing:** The existing tests don't cover this component. Manual testing: Open project, quickly switch away from sidebar. No console errors should appear.

---

### 2. Panic-Prone Window Acquisition (Rust)

**File:** `src-tauri/src/lib.rs`

**Problem:** Lines 246-248 have double panic potential via `.unwrap()` and `.expect()`.

**Current Code (lines 246-248):**
```rust
#[cfg(target_os = "macos")]
{
    let window = app.get_webview_window("main").unwrap();
    apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
        .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
}
```

**Fix:** Use idiomatic optional pattern:
```rust
#[cfg(target_os = "macos")]
{
    if let Some(window) = app.get_webview_window("main") {
        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
    }
}
```

**Rationale:** The vibrancy is cosmetic. If it fails, the app should still work. The `let _ =` pattern silently ignores errors, which is appropriate here since we're already inside a `#[cfg(target_os = "macos")]` block.

**Testing:** Run `cargo check` to verify compilation. Run app and verify vibrancy still works.

---

### 3. Blocking recv() in Async Context (Rust)

**File:** `src-tauri/src/commands/watcher.rs`

**Problem:** Lines 83-97 use `std::sync::mpsc::Receiver::recv()` (blocking) inside `tokio::spawn()`. This blocks a tokio worker thread while waiting for events.

**Current Code (lines 25 and 83-97):**
```rust
// Line 25: Channel creation
let (tx, rx) = mpsc::channel();

// The tx is passed to notify::recommended_watcher which REQUIRES std::sync::mpsc::Sender
let mut watcher = notify::recommended_watcher(move |result| match result {
    Ok(event) => {
        if let Err(e) = tx.send(event) { ... }
    }
    ...
});

// Lines 83-97: The problematic loop
tokio::spawn(async move {
    while let Ok(event) = rx.recv() {  // <-- BLOCKING inside async!
        // ...
    }
});
```

**Constraint:** The `notify` library requires `std::sync::mpsc::Sender` for its callback. We cannot simply swap to a tokio channel.

**Fix Options (choose one):**

**Option A: Bridge Pattern (Recommended)**

Keep the std channel for notify, bridge to tokio channel inside the async task:
```rust
let (tx, rx) = mpsc::channel();

// ... watcher setup with tx (unchanged) ...

// Bridge in the spawned task
let app_handle = app.clone();
tokio::spawn(async move {
    let (async_tx, mut async_rx) = tokio::sync::mpsc::unbounded_channel();

    // Spawn blocking bridge in background
    std::thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            if async_tx.send(event).is_err() {
                break; // Receiver dropped
            }
        }
    });

    // Now use async receive
    let mut event_buffer = Vec::new();
    let mut last_event_time = std::time::Instant::now();

    while let Some(event) = async_rx.recv().await {
        event_buffer.push(event);

        if last_event_time.elapsed() > Duration::from_millis(500) {
            process_events(&app_handle, &mut event_buffer).await;
            event_buffer.clear();
        }
        last_event_time = std::time::Instant::now();
    }
});
```

**Option B: Use spawn_blocking for recv**

Wrap just the blocking recv in spawn_blocking:
```rust
tokio::spawn(async move {
    let mut event_buffer = Vec::new();
    let mut last_event_time = std::time::Instant::now();

    loop {
        // Move blocking recv to blocking thread pool
        let event = tokio::task::spawn_blocking({
            let rx = rx.clone(); // Won't work - rx isn't Clone
            move || rx.recv()
        }).await;

        // ... This approach has issues with rx ownership
    }
});
```
Note: Option B is tricky because `Receiver` isn't `Clone`. Option A is cleaner.

**Option C: Accept Current Behavior**

The current implementation blocks one tokio worker thread while waiting. In Tauri's multi-threaded runtime, this is suboptimal but functional. File events are infrequent, so impact is minimal. Consider this a known limitation if the bridge adds too much complexity.

**Testing:** Run `cargo check`. Test file watching by modifying files in the project. Verify events still trigger UI updates.

---

### 4. Alt Key Listener Re-registration

**File:** `src/components/editor/Editor.tsx`

**Problem:** Lines 93-135 have `isAltPressed` in dependencies, causing listener re-registration on every Alt key toggle.

**Constraint:** We CANNOT simply replace `useState` with `useRef` because `useImageHover` at line 67 depends on `isAltPressed` state:
```typescript
const hoveredImage = useImageHover(viewRef.current, isAltPressed)
```
If we used a ref, the hook wouldn't re-render when Alt state changes, breaking image preview.

**Current Code (lines 34 and 93-135):**
```typescript
const [isAltPressed, setIsAltPressed] = useState(false)

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && !isAltPressed) {      // <-- Uses closure variable
      setIsAltPressed(true)
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: altKeyEffect.of(true),
        })
      }
    }
  }
  // ... keyup, blur handlers similar

  // ... addEventListener calls

}, [isAltPressed])  // <-- Re-registers on every alt toggle!
```

**Fix:** Keep `useState` for component reactivity, add a separate ref to track dispatch state. This allows empty dependencies while preserving the state for `useImageHover`:

```typescript
const [isAltPressed, setIsAltPressed] = useState(false)
const altDispatchedRef = useRef(false)  // NEW: Track whether we've dispatched

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && !altDispatchedRef.current) {
      setIsAltPressed(true)
      altDispatchedRef.current = true
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: altKeyEffect.of(true),
        })
      }
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!e.altKey && altDispatchedRef.current) {
      setIsAltPressed(false)
      altDispatchedRef.current = false
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: altKeyEffect.of(false),
        })
      }
    }
  }

  const handleBlur = () => {
    if (altDispatchedRef.current) {
      setIsAltPressed(false)
      altDispatchedRef.current = false
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: altKeyEffect.of(false),
        })
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleBlur)

  return () => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleBlur)
  }
}, [])  // <-- Now stable! No isAltPressed dependency
```

**Key insight:** The ref tracks "have we dispatched the CodeMirror effect?" while state tracks "is Alt pressed?" for React components. They serve different purposes.

**Testing:**
1. Open editor, hold Alt key - URLs should highlight
2. Hover over image URL while holding Alt - image preview should appear
3. Release Alt - highlights disappear, preview disappears
4. Rapidly press/release Alt - no performance issues, no console errors

---

### 5. Remove Migration TODO Comment

**File:** `src/lib/project-registry/migrations.ts`

**Problem:** Line 4 has a TODO comment that's no longer relevant.

**Current Code (lines 1-7):**
```typescript
/**
 * Preference structure migrations
 *
 * TODO: Remove this entire file after v2.5.0 when most users have upgraded
 *
 * This module handles migration from v1 to v2 preference structure.
 */
```

**Fix:** Remove only the TODO line, keep the module:
```typescript
/**
 * Preference structure migrations
 *
 * This module handles migration from v1 to v2 preference structure.
 */
```

**Rationale:** The migration code should remain as a safety net for late upgraders. Only the TODO comment should be removed since we're keeping the code.

**Testing:** None needed.

---

### 6. Remove Redundant React.memo

**File:** `src/components/editor/ImagePreview.tsx`

**Problem:** Line 161 has `React.memo(ImagePreviewComponent)` which is redundant with React Compiler.

**Current Code (lines 160-161):**
```typescript
// Memoize to prevent unnecessary re-renders when parent re-renders
export const ImagePreview = React.memo(ImagePreviewComponent)
```

**Fix:** Export the component directly:
```typescript
export const ImagePreview = ImagePreviewComponent
```

**Note:** The comment should also be removed since it's no longer accurate.

**Important:** Do NOT remove the `React.memo(() => true)` in `Editor.tsx` - that's a hard guarantee preventing keystroke-triggered re-renders which the compiler may not optimize.

**Testing:** Run `pnpm run check:all`. Verify ImagePreview still works correctly.

---

## Cleanup Tasks

### 7. Settings Object Duplication

**Files:**
- `src/components/preferences/panes/GeneralPane.tsx` (7 handlers)
- `src/hooks/useDOMEventListeners.ts` (2 handlers)

**Problem:** Every settings update manually reconstructs the entire `GlobalSettings` object. The registry at `src/lib/project-registry/index.ts` already does deep merging (lines 284-295):

```typescript
async updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
  this.globalSettings = {
    ...this.globalSettings,
    ...settings,
    general: {
      ...this.globalSettings.general,
      ...settings.general,
    },
    appearance: {
      ...this.globalSettings.appearance,
      ...settings.appearance,
    },
  }
  await saveGlobalSettings(this.globalSettings)
}
```

**Understanding the Deep Merge:**

The registry merges ONE level deep for `general` and `appearance`:
```typescript
general: {
  ...this.globalSettings.general,   // preserves all existing fields
  ...settings.general,              // overwrites only fields we pass
}
```

This means:
- **Top-level properties** (like `ideCommand`, `theme`): Just pass the new value, other fields are preserved
- **Nested objects** (like `highlights`, `headingColor`): Must spread the nested object yourself, or you'll overwrite the entire nested object

**Fix for GeneralPane.tsx:**

Replace each handler with minimal updates. Example transformations:

**handleIdeCommandChange (lines 27-52):**
```typescript
// Before (20+ lines)
const handleIdeCommandChange = useCallback(
  (value: string) => {
    void updateGlobal({
      general: {
        ideCommand: value === 'none' ? '' : value,
        theme: globalSettings?.general?.theme || 'system',
        highlights: globalSettings?.general?.highlights || { ... },
        autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
        defaultFileType: globalSettings?.general?.defaultFileType || 'md',
      },
      appearance: globalSettings?.appearance || { ... },
    })
  },
  [updateGlobal, globalSettings?.general, globalSettings?.appearance]
)

// After (3 lines)
const handleIdeCommandChange = useCallback(
  (value: string) => {
    void updateGlobal({ general: { ideCommand: value === 'none' ? '' : value } })
  },
  [updateGlobal]
)
```

**handleThemeChange (lines 54-88):**
```typescript
// After
const handleThemeChange = useCallback(
  (value: 'light' | 'dark' | 'system') => {
    setTheme(value)
    void updateGlobal({ general: { theme: value } })
  },
  [setTheme, updateGlobal]
)
```

**handleDefaultFileTypeChange (lines 90-115):**
```typescript
// After
const handleDefaultFileTypeChange = useCallback(
  (value: string) => {
    void updateGlobal({ general: { defaultFileType: value as 'md' | 'mdx' } })
  },
  [updateGlobal]
)
```

**handleHeadingColorChange (lines 117-143):**
```typescript
// After - still needs to spread headingColor since it's nested
const handleHeadingColorChange = useCallback(
  (mode: 'light' | 'dark', color: string) => {
    void updateGlobal({
      appearance: {
        headingColor: {
          ...globalSettings?.appearance?.headingColor,
          [mode]: color,
        },
      },
    })
  },
  [updateGlobal, globalSettings?.appearance?.headingColor]
)
```

**handleAutoSaveDelayChange (lines 153-178):**
```typescript
// After
const handleAutoSaveDelayChange = useCallback(
  (value: string) => {
    void updateGlobal({ general: { autoSaveDelay: parseInt(value, 10) } })
  },
  [updateGlobal]
)
```

**handleEditorBaseFontSizeChange (lines 182-214):**
```typescript
// After
const handleEditorBaseFontSizeChange = useCallback(
  (value: string) => {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return
    const size = Math.max(1, Math.min(30, parsed))
    void updateGlobal({ appearance: { editorBaseFontSize: size } })
  },
  [updateGlobal]
)
```

**Fix for useDOMEventListeners.ts:**

**handleToggleHighlight (lines 79-108):**
```typescript
// Before
const handleToggleHighlight = (partOfSpeech: PartOfSpeech) => {
  const { globalSettings, updateGlobalSettings } = useProjectStore.getState()
  const currentValue = globalSettings?.general?.highlights?.[partOfSpeech] ?? true

  const newSettings = {
    general: {
      ideCommand: globalSettings?.general?.ideCommand || '',
      theme: globalSettings?.general?.theme || 'system',
      highlights: {
        nouns: globalSettings?.general?.highlights?.nouns ?? true,
        // ... all fields
        [partOfSpeech]: !currentValue,
      },
      autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
      defaultFileType: globalSettings?.general?.defaultFileType || 'md',
    },
  }
  // ...
}

// After - still spread highlights since it's nested
const handleToggleHighlight = (partOfSpeech: PartOfSpeech) => {
  const { globalSettings, updateGlobalSettings } = useProjectStore.getState()
  const currentValue = globalSettings?.general?.highlights?.[partOfSpeech] ?? true

  void updateGlobalSettings({
    general: {
      highlights: {
        ...globalSettings?.general?.highlights,
        [partOfSpeech]: !currentValue,
      },
    },
  }).then(() => {
    setTimeout(() => {
      updateCopyeditModePartsOfSpeech()
    }, 50)
  })
}
```

**handleToggleAllHighlights (lines 110-139):**
```typescript
// After
const handleToggleAllHighlights = () => {
  const { globalSettings, updateGlobalSettings } = useProjectStore.getState()
  const highlights = globalSettings?.general?.highlights || {}
  const anyEnabled = Object.values(highlights).some(enabled => enabled)
  const newValue = !anyEnabled

  void updateGlobalSettings({
    general: {
      highlights: {
        nouns: newValue,
        verbs: newValue,
        adjectives: newValue,
        adverbs: newValue,
        conjunctions: newValue,
      },
    },
  }).then(() => {
    setTimeout(() => {
      updateCopyeditModePartsOfSpeech()
    }, 50)
  })
}
```

**Testing:** Open preferences, change each setting. Verify settings persist after app restart. Toggle parts-of-speech highlights via command palette.

---

### 8. Consolidate Logging

**Scope:** 38+ console calls across 23+ files

**Current State:** No clear conventions for when to use `console.*` vs Tauri logger.

**Required Work:**

**Step 1: Audit console calls**

Run this to get a complete list:
```bash
grep -rn "console\.\(log\|warn\|error\|info\|debug\)" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test."
```

Categorize each as:
- **Dev-only:** Debug statements that should be removed or wrapped in dev checks
- **Production-worthy:** Important info that should go to Tauri logger
- **Scripts:** Build/release scripts (keep console for CLI output)

**Step 2: Define conventions**

Add to `docs/developer/logging.md` a decision tree:

```markdown
## When to Use Which

### Use Tauri Logger (`@tauri-apps/plugin-log`)
- User-facing errors that might need support investigation
- Important lifecycle events (project open, file save failures)
- Security-relevant operations
- Anything you'd want in the macOS Console.app

### Use console.* (Development Only)
- Temporary debugging (remove before commit)
- Performance timing in development
- Test output

### Use console.* (Production OK)
- Build scripts and CLI tools (e.g., `scripts/*.js`)
- Node.js scripts that run outside Tauri

### Never Use
- `console.log` for production error reporting (use logger)
- Sensitive information in any log
```

**Step 3: Identify current violations**

From the grep results, these are the main source files with console usage:
- `src/store/mdxComponentsStore.ts:32` - `console.error` (keep, but consider logger)
- `src/store/editorStore.ts:115` - `console.warn` (appropriate for dev warning)
- `src/store/projectStore.ts:275,293` - `console.warn` (should use logger for persistence issues)

**Step 4: Refactor**

For production-worthy logging, replace with Tauri logger:
```typescript
// Before
console.error('Failed to load MDX components:', error)

// After
import { error as logError } from '@tauri-apps/plugin-log'
void logError(`Astro Editor [MDX] Failed to load components: ${String(error)}`)
```

**AI Instructions Addition to logging.md:**
```markdown
## AI Assistant Instructions

When writing new code:
1. Default to Tauri logger for any error or warning
2. Never commit `console.log` for debugging
3. Use the `[TAG]` format: `Astro Editor [COMPONENT_NAME] message`
4. For temporary debugging, use `console.log` with a `// TODO: remove` comment
```

**Testing:** Run app, check macOS Console.app for proper log output. Verify no unexpected console output in browser devtools (except for dev builds).

---

## Removal Tasks

### 9. Remove Typewriter Mode

**Scope:** 15 steps across 14 source files + 1 CSS file + 3 doc/marketing files. Delete 1 source file.

**Why Remove:** Feature is undocumented, unmarketable, and implementation is problematic (uses setTimeout for scrolling).

**Files to Modify (in order):**

#### Step 1: Delete the extension file
```bash
rm -f src/lib/editor/extensions/typewriter-mode.ts
```

#### Step 2: Remove from createExtensions.ts

**File:** `src/lib/editor/extensions/createExtensions.ts`

Remove import (line 13):
```typescript
// DELETE: import { createTypewriterModeExtension } from './typewriter-mode'
```

Remove from extensions array (line 76):
```typescript
// DELETE: ...createTypewriterModeExtension(),
```

#### Step 3: Remove from keymap.ts

**File:** `src/lib/editor/extensions/keymap.ts`

Remove keyboard shortcut (lines 82-87):
```typescript
// DELETE this block:
{
  key: 'Mod-Shift-t',
  run: () => {
    globalCommandRegistry.execute('toggleTypewriterMode')
    return true
  },
},
```

#### Step 4: Remove from editorCommands.ts

**File:** `src/lib/editor/commands/editorCommands.ts`

Remove the command function (lines 60-66):
```typescript
// DELETE:
export const createTypewriterModeCommand = (): EditorCommand => {
  return () => {
    const toggleTypewriterMode = useUIStore.getState().toggleTypewriterMode
    toggleTypewriterMode()
    return true
  }
}
```

Remove from registry (line 81):
```typescript
// DELETE: toggleTypewriterMode: createTypewriterModeCommand(),
```

#### Step 5: Remove from editor command types

**File:** `src/lib/editor/commands/types.ts`

Remove from interface (line 19):
```typescript
// DELETE: toggleTypewriterMode: EditorCommand
```

#### Step 6: Remove from app-commands.ts

**File:** `src/lib/commands/app-commands.ts`

Remove the command definition (lines 163-173):
```typescript
// DELETE this entire object from viewModeCommands array:
{
  id: 'toggle-typewriter-mode',
  label: 'Toggle Typewriter Mode',
  description: 'Keep current line centered while typing',
  icon: Edit,
  group: 'settings',
  execute: (context: CommandContext) => {
    context.toggleTypewriterMode()
  },
  isAvailable: () => true,
},
```

#### Step 7: Remove from command types

**File:** `src/lib/commands/types.ts`

Remove from interface (line 29):
```typescript
// DELETE: toggleTypewriterMode: () => void
```

#### Step 8: Remove from uiStore.ts

**File:** `src/store/uiStore.ts`

Remove from interface (line 8):
```typescript
// DELETE: typewriterModeEnabled: boolean
```

Remove from interface (line 18):
```typescript
// DELETE: toggleTypewriterMode: () => void
```

Remove from initial state (line 30):
```typescript
// DELETE: typewriterModeEnabled: false,
```

Remove the action (lines 55-57):
```typescript
// DELETE:
toggleTypewriterMode: () => {
  set(state => ({ typewriterModeEnabled: !state.typewriterModeEnabled }))
},
```

#### Step 9: Remove from Editor.tsx

**File:** `src/components/editor/Editor.tsx`

Remove import (line 15):
```typescript
// DELETE: import { toggleTypewriterMode } from '../../lib/editor/extensions/typewriter-mode'
```

Remove state subscription (line 31):
```typescript
// DELETE: const typewriterModeEnabled = useUIStore(state => state.typewriterModeEnabled)
```

Update handleModeChange callback (lines 70-85). Remove typewriter-related code:
```typescript
// BEFORE (lines 70-85):
const handleModeChange = useCallback(() => {
  const {
    focusModeEnabled: currentFocusMode,
    typewriterModeEnabled: currentTypewriterMode,  // DELETE
  } = useUIStore.getState()

  if (viewRef.current) {
    viewRef.current.dispatch({
      effects: [
        toggleFocusMode.of(currentFocusMode),
        toggleTypewriterMode.of(currentTypewriterMode),  // DELETE
      ],
    })
  }
}, [])

// AFTER:
const handleModeChange = useCallback(() => {
  const { focusModeEnabled: currentFocusMode } = useUIStore.getState()

  if (viewRef.current) {
    viewRef.current.dispatch({
      effects: [toggleFocusMode.of(currentFocusMode)],
    })
  }
}, [])
```

Remove from mode change effect dependency (line 90):
```typescript
// CHANGE FROM:
}, [handleModeChange, focusModeEnabled, typewriterModeEnabled])
// TO:
}, [handleModeChange, focusModeEnabled])
```

#### Step 10: Remove from useCommandContext.ts

**File:** `src/hooks/commands/useCommandContext.ts`

Remove the event dispatcher (lines 80-82):
```typescript
// DELETE:
toggleTypewriterMode: () => {
  window.dispatchEvent(new CustomEvent('toggle-typewriter-mode'))
},
```

#### Step 11: Remove from useDOMEventListeners.ts

**File:** `src/hooks/useDOMEventListeners.ts`

Remove reference in docstring (line 30):
```typescript
// DELETE: * - 'toggle-typewriter-mode': Toggles typewriter mode
```

Remove handler (lines 75-77):
```typescript
// DELETE:
const handleToggleTypewriterMode = () => {
  useUIStore.getState().toggleTypewriterMode()
}
```

Remove event listener registration (lines 153-156):
```typescript
// DELETE:
window.addEventListener(
  'toggle-typewriter-mode',
  handleToggleTypewriterMode
)
```

Remove from cleanup (lines 170-173):
```typescript
// DELETE:
window.removeEventListener(
  'toggle-typewriter-mode',
  handleToggleTypewriterMode
)
```

#### Step 12: Update test files

**File:** `src/hooks/editor/useEditorSetup.test.ts`

Remove from mock (line 65):
```typescript
// DELETE: toggleTypewriterMode: vi.fn(),
```

**File:** `src/lib/editor/commands/CommandRegistry.test.ts`

Remove from mock (line 35):
```typescript
// DELETE: toggleTypewriterMode: vi.fn(() => true),
```

**File:** `src/components/editor/__tests__/focus-typewriter-modes.test.tsx`

This test file tests both focus and typewriter modes. Options:
1. **Rename and refactor:** Rename to `focus-mode.test.tsx` and remove all typewriter tests
2. **Delete entirely:** If focus mode tests are covered elsewhere

Recommended: Rename to `focus-mode.test.tsx` and remove all typewriter-related tests:
- Remove all `toggleTypewriterMode` references
- Remove all `typewriterModeEnabled` assertions
- Update test descriptions

#### Step 13: Remove CSS

**File:** `src/components/editor/Editor.css`

Remove typewriter mode styles (lines 45-86):
```css
/* DELETE lines 45-86: */

/* Typewriter Mode Enhancements */
.cm-editor.typewriter-mode {
  position: relative;
}

.cm-editor.typewriter-mode::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(
    to bottom,
    var(--editor-color-background) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

.cm-editor.typewriter-mode::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(
    to top,
    var(--editor-color-background) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

/* Ensure content stays above gradients */
.cm-editor.typewriter-mode .cm-content {
  position: relative;
  z-index: 2;
}
```

#### Step 14: Clean up unused imports

**File:** `src/lib/commands/app-commands.ts`

After removing the typewriter mode command, check if the `Edit` icon is still used elsewhere in the file. If not, remove it from the import:
```typescript
// Check this import - Edit may no longer be needed:
import {
  // ...
  Edit,  // <-- Remove if unused
  // ...
} from 'lucide-react'
```

#### Step 15: Update documentation

**File:** `README.md`

Update line 14 to remove typewriter mode reference:
```markdown
// BEFORE:
- Focus mode (highlights current sentence), typewriter mode (cursor stays centered), and copyedit mode (highlights parts of speech).

// AFTER:
- Focus mode (highlights current sentence) and copyedit mode (highlights parts of speech).
```

**File:** `docs/user-guide.md`

Remove the Typewriter Mode section entirely (around lines 448-453):
```markdown
// DELETE this entire section:
### Typewriter Mode

> [!WARNING]
> This is currently unreliable and could cause the editor window to behave in unexpected ways.

Keeps the editor cursor centered vertically in the window and scrolls the document – much like a typewriter.
```

Also update keyboard shortcuts documentation in the user guide if it mentions `Cmd+Shift+T` for typewriter mode.

**File:** `website/index.html`

Update line 216 to remove typewriter mode reference:
```html
// BEFORE:
"Focus and typewriter modes",

// AFTER:
"Focus mode",
```

**Testing:**
1. Run `pnpm run check:all` - should pass with no TypeScript errors
2. Run `pnpm test` - all tests should pass
3. Open editor, verify focus mode still works
4. Verify `Cmd+Shift+F` toggles focus mode
5. Verify `Cmd+Shift+T` does nothing (or falls through to system)
6. Open command palette, verify "Toggle Typewriter Mode" is gone

---

## Future Considerations (Not Urgent)

### Focus Mode Decoration Inefficiency

**File:** `src/lib/editor/extensions/focus-mode.ts:56-107`

**Current Approach:** Creates two massive decorations spanning 99% of the document, rebuilt on every cursor movement (O(doc_size)).

**Better Approach:** Dim all content via base CSS class, apply ONE small decoration to "undim" the current sentence (O(sentence_size)).

**Why Not Now:** Current approach works. The optimization requires careful CSS specificity work and comprehensive testing. File for future performance optimization if focus mode becomes noticeably slow on large documents.

---

## Verification Checklist

After completing all tasks, run:

```bash
# TypeScript and Rust checks
pnpm run check:all

# All tests
pnpm test

# Manual testing
# 1. Open a project
# 2. Change settings in preferences
# 3. Toggle focus mode (Cmd+Shift+F)
# 4. Hold Alt key for URL highlighting
# 5. Verify typewriter mode is completely gone
```
