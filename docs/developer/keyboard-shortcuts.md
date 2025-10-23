# Keyboard Shortcuts Guide

This guide covers the keyboard shortcut implementation using `react-hotkeys-hook`.

## Table of Contents

- [Overview](#overview)
- [Implementation Pattern](#implementation-pattern)
- [Cross-Platform Support](#cross-platform-support)
- [Integration with Command System](#integration-with-command-system)
- [Current Shortcuts](#current-shortcuts)
- [Adding New Shortcuts](#adding-new-shortcuts)
- [Best Practices](#best-practices)

## Overview

The app uses **`react-hotkeys-hook`** for standardized, cross-platform keyboard shortcuts. This replaces manual event handling and provides consistent behavior across operating systems.

**Why react-hotkeys-hook?**

- **Cross-platform compatibility**: `mod` key automatically maps to Cmd (macOS) or Ctrl (Windows/Linux)
- **Declarative API**: Define shortcuts where they're used, not in global event handlers
- **Performance**: Built-in event management and cleanup
- **Type safety**: Better TypeScript integration than manual event handling
- **React integration**: Works seamlessly with React lifecycle

## Implementation Pattern

### Basic Usage

```typescript
import { useHotkeys } from 'react-hotkeys-hook'

// In a component
const MyComponent = () => {
  useHotkeys(
    'mod+s', // Shortcut key combination
    () => {
      // Handler function
      console.log('Save triggered!')
    },
    { preventDefault: true } // Options
  )

  return <div>Component content</div>
}
```

### With Dependencies

```typescript
const Editor = () => {
  const { saveFile } = useEditorStore()

  useHotkeys(
    'mod+s',
    () => {
      void saveFile()
    },
    {
      preventDefault: true,
      // Optional: scope shortcuts to prevent conflicts
      scopes: ['editor'],
    },
    [saveFile] // Dependencies array
  )

  return <textarea />
}
```

### Options

```typescript
interface HotkeyOptions {
  preventDefault?: boolean // Prevent default browser behavior
  enabled?: boolean // Enable/disable shortcut conditionally
  enableOnFormTags?: boolean // Allow in form elements (default: false)
  scopes?: string[] // Shortcut scopes for organization
  splitKey?: string // Key combination separator (default: '+')
}
```

## Cross-Platform Support

### The `mod` Key

The `mod` key automatically maps to the correct modifier for each platform:

- **macOS**: `Cmd` (⌘)
- **Windows/Linux**: `Ctrl`

```typescript
// Works on all platforms
useHotkeys('mod+s', saveHandler)

// Equivalent to:
// macOS: Cmd+S
// Windows/Linux: Ctrl+S
```

### Platform-Specific Shortcuts

For rare cases where you need platform-specific behavior:

```typescript
import { isMac } from '@/lib/utils'

useHotkeys(isMac ? 'cmd+k' : 'ctrl+k', commandPaletteHandler)
```

### Key Names

Common key names:

- **Modifiers**: `mod`, `ctrl`, `shift`, `alt`, `meta`, `cmd` (macOS only)
- **Letters**: `a` through `z`
- **Numbers**: `1` through `0`
- **Special**: `enter`, `escape`, `space`, `tab`, `backspace`, `delete`
- **Arrows**: `up`, `down`, `left`, `right`
- **Function**: `f1` through `f12`
- **Symbols**: `comma`, `period`, `slash`, `backslash`, `minus`, `equals`

### Key Combinations

```typescript
// Single modifier + key
'mod+s'

// Multiple modifiers
'mod+shift+p'

// Multiple keys (sequence)
'g i' // Press 'g' then 'i'

// Alternative shortcuts (OR)
'mod+s, ctrl+s' // Either mod+s OR ctrl+s
```

## Integration with Command System

Keyboard shortcuts work seamlessly with the command registry, allowing the same actions to be triggered from:

- Keyboard shortcuts
- Menu items
- Command palette
- Programmatic calls

### Pattern

```typescript
import { useHotkeys } from 'react-hotkeys-hook'
import { globalCommandRegistry } from '@/lib/editor/commands'

const Editor = () => {
  // Bold
  useHotkeys(
    'mod+b',
    () => {
      globalCommandRegistry.execute('toggleBold')
    },
    { preventDefault: true }
  )

  // Italic
  useHotkeys(
    'mod+i',
    () => {
      globalCommandRegistry.execute('toggleItalic')
    },
    { preventDefault: true }
  )

  // Heading with parameter
  useHotkeys(
    'mod+1',
    () => {
      globalCommandRegistry.execute('formatHeading', 1)
    },
    { preventDefault: true }
  )

  return <div>Editor</div>
}
```

## Current Shortcuts

### Global Shortcuts

Defined in `src/components/layout/Layout.tsx`:

```typescript
// File operations
useHotkeys('mod+s', handleSave) // Save current file
useHotkeys('mod+n', handleNewFile) // New file
useHotkeys('mod+w', handleCloseFile) // Close file

// Navigation
useHotkeys('mod+1', toggleSidebar) // Toggle sidebar
useHotkeys('mod+2', toggleFrontmatter) // Toggle frontmatter panel

// Settings
useHotkeys('mod+comma', openPreferences) // Open preferences

// Command palette
useHotkeys('mod+k', openCommandPalette) // Open command palette
```

### Editor Shortcuts

Defined in `src/components/editor/Editor.tsx`:

```typescript
// Formatting
useHotkeys('mod+b', () => globalCommandRegistry.execute('toggleBold'))
useHotkeys('mod+i', () => globalCommandRegistry.execute('toggleItalic'))
useHotkeys('mod+k', () => globalCommandRegistry.execute('insertLink'))

// Headings
useHotkeys('mod+1', () => globalCommandRegistry.execute('formatHeading', 1))
useHotkeys('mod+2', () => globalCommandRegistry.execute('formatHeading', 2))
useHotkeys('mod+3', () => globalCommandRegistry.execute('formatHeading', 3))

// Lists
useHotkeys('mod+shift+7', () => globalCommandRegistry.execute('toggleNumberedList'))
useHotkeys('mod+shift+8', () => globalCommandRegistry.execute('toggleBulletList'))

// Blocks
useHotkeys('mod+shift+c', () => globalCommandRegistry.execute('insertCodeBlock'))
useHotkeys('mod+shift+q', () => globalCommandRegistry.execute('toggleBlockquote'))
```

## Adding New Shortcuts

### Step 1: Choose Keybinding

Consider:

1. **Convention**: Follow OS conventions (e.g., `mod+s` for save)
2. **Conflicts**: Avoid browser shortcuts (e.g., `mod+t` for new tab)
3. **Discoverability**: Common modifier patterns (`mod+`, `mod+shift+`)
4. **Related shortcuts**: Group related actions (all headings use `mod+[1-6]`)

### Step 2: Implement Shortcut

```typescript
// In the appropriate component
import { useHotkeys } from 'react-hotkeys-hook'

const MyComponent = () => {
  useHotkeys(
    'mod+shift+d', // Your chosen keybinding
    () => {
      // Your handler logic
      handleDuplicateLine()
    },
    {
      preventDefault: true,
      // Optional: only enable when condition met
      enabled: isEditorFocused,
    }
  )

  return <div>Component</div>
}
```

### Step 3: Integrate with Command System (Optional)

If the action should also be available via menu/palette:

```typescript
// 1. Register command
globalCommandRegistry.register({
  id: 'duplicateLine',
  name: 'Duplicate Line',
  group: 'edit',
  execute: (editorView) => {
    // Implementation
  },
})

// 2. Use command in shortcut
useHotkeys(
  'mod+shift+d',
  () => {
    globalCommandRegistry.execute('duplicateLine')
  },
  { preventDefault: true }
)
```

### Step 4: Update Documentation

Add to:

1. **This file** (Current Shortcuts section)
2. **Menu labels** (if applicable)
3. **Command palette** (if applicable)
4. **User documentation**

## Best Practices

### 1. Always Prevent Default

```typescript
// ✅ GOOD: Prevents browser behavior
useHotkeys('mod+s', handleSave, { preventDefault: true })

// ❌ BAD: Browser might trigger "Save Page"
useHotkeys('mod+s', handleSave)
```

### 2. Use Stable Dependencies

```typescript
// ✅ GOOD: Using getState pattern for stable dependencies
useHotkeys(
  'mod+s',
  () => {
    const { currentFile, saveFile } = useEditorStore.getState()
    if (currentFile) {
      void saveFile()
    }
  },
  { preventDefault: true },
  [] // Stable dependency array
)

// ❌ BAD: Unstable dependencies cause re-registration
const { currentFile, saveFile } = useEditorStore()
useHotkeys(
  'mod+s',
  () => {
    if (currentFile) void saveFile()
  },
  { preventDefault: true },
  [currentFile, saveFile] // Re-registers on every change
)
```

### 3. Scope Shortcuts Appropriately

```typescript
// ✅ GOOD: Editor shortcuts only active in editor scope
useHotkeys(
  'mod+b',
  () => globalCommandRegistry.execute('toggleBold'),
  {
    preventDefault: true,
    scopes: ['editor'],
  }
)

// Activate scope when editor is focused
const { enableScope, disableScope } = useHotkeysContext()

useEffect(() => {
  if (isEditorFocused) {
    enableScope('editor')
  } else {
    disableScope('editor')
  }
}, [isEditorFocused])
```

### 4. Conditional Enablement

```typescript
// ✅ GOOD: Only enable when applicable
const hasSelection = useEditorStore(state => !!state.selection)

useHotkeys(
  'mod+b',
  () => globalCommandRegistry.execute('toggleBold'),
  {
    preventDefault: true,
    enabled: hasSelection, // Only active when text is selected
  }
)
```

### 5. Avoid Form Element Conflicts

```typescript
// By default, shortcuts are disabled in form elements (input, textarea, select)

// To enable in form elements (use sparingly):
useHotkeys(
  'mod+s',
  handleSave,
  {
    preventDefault: true,
    enableOnFormTags: true, // Also works in inputs
  }
)
```

### 6. Document Shortcuts

```typescript
// ✅ GOOD: Clear comment explaining shortcut
// Cmd/Ctrl+S: Save current file
useHotkeys('mod+s', handleSave, { preventDefault: true })

// Cmd/Ctrl+Shift+P: Open command palette
useHotkeys('mod+shift+p', openCommandPalette, { preventDefault: true })
```

## Debugging Shortcuts

### Check if Shortcut is Registered

```typescript
import { useHotkeys } from 'react-hotkeys-hook'

useHotkeys(
  'mod+s',
  () => {
    console.log('Shortcut triggered!') // Add logging
    handleSave()
  },
  { preventDefault: true }
)
```

### Check Current Scope

```typescript
import { useHotkeysContext } from 'react-hotkeys-hook'

const { activeScopes } = useHotkeysContext()
console.log('Active scopes:', activeScopes)
```

### Verify Key Names

If a shortcut isn't working, verify key names:

```typescript
useHotkeys(
  'mod+s',
  (event) => {
    console.log('Key pressed:', event.key)
    console.log('Modifiers:', {
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    })
    handleSave()
  },
  { preventDefault: true }
)
```

## Advanced Patterns

### Sequential Key Combinations

```typescript
// Vim-like 'g g' to go to top
useHotkeys('g g', scrollToTop, { preventDefault: true })

// 'g i' to go to issues
useHotkeys('g i', navigateToIssues, { preventDefault: true })
```

### Multiple Alternative Shortcuts

```typescript
// Accept either shortcut
useHotkeys(
  'mod+s, ctrl+s',
  handleSave,
  { preventDefault: true }
)
```

### Shortcut Chaining

```typescript
// Only trigger after condition
useHotkeys(
  'mod+shift+k',
  () => {
    if (canDeleteLine()) {
      deleteLine()
    }
  },
  {
    preventDefault: true,
    enabled: isEditorFocused,
  }
)
```

---

**Remember**: Keep shortcuts consistent with OS conventions, prevent browser defaults, and integrate with the command system for maximum flexibility.
