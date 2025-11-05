# Command System

## Overview

Astro Editor uses a **command pattern** to centralize all user-triggered actions. This creates a single source of truth for operations, enabling keyboard shortcuts, native menus, and the command palette to share the same logic without duplication.

## What is the Command Pattern?

The command pattern encapsulates actions as objects with a consistent interface. Instead of duplicating logic across different UI triggers (buttons, menus, shortcuts), we define each action once and execute it from multiple places.

```typescript
// Single command definition
const saveCommand: Command = {
  id: 'save-file',
  name: 'Save File',
  execute: async () => {
    const { saveFile } = useEditorStore.getState()
    await saveFile()
  }
}

// Executed from multiple places:
// 1. Keyboard shortcut (Cmd+S)
// 2. Native menu (File → Save)
// 3. Command palette (Cmd+K → "Save File")
// 4. Toolbar button
```

## Why Use the Command Pattern?

### Single Source of Truth

Without the command pattern, save logic would be duplicated in multiple places:

```typescript
// ❌ BAD: Duplicated logic
// In toolbar button
<Button onClick={() => {
  const { saveFile } = useEditorStore.getState()
  await saveFile()
}}>Save</Button>

// In keyboard shortcut
useHotkeys('mod+s', () => {
  const { saveFile } = useEditorStore.getState()
  await saveFile()
})

// In native menu (Tauri event)
listen('menu-save', () => {
  const { saveFile } = useEditorStore.getState()
  await saveFile()
})

// In command palette
// ... yet another copy
```

With the command pattern, logic is defined once:

```typescript
// ✅ GOOD: Single definition
const saveCommand: Command = {
  id: 'save-file',
  name: 'Save File',
  execute: async () => {
    const { saveFile } = useEditorStore.getState()
    await saveFile()
  }
}

// Executed everywhere the same way
globalCommandRegistry.execute('save-file')
```

### Benefits

1. **No Duplication**: Logic defined once, used everywhere
2. **Consistency**: Same behavior from all triggers
3. **Discoverability**: Command palette shows all available actions
4. **Testability**: Test commands independently of UI
5. **Extensibility**: Easy to add new commands or triggers
6. **Maintainability**: Update logic in one place

## Command Registry Architecture

### Global Registry

All commands are managed by a single `CommandRegistry` instance:

```typescript
// lib/commands/CommandRegistry.ts
export class CommandRegistry {
  private commands = new Map<string, Command>()

  register(command: Command): void {
    this.commands.set(command.id, command)
  }

  execute(id: string, ...args: unknown[]): void {
    const command = this.commands.get(id)
    if (command) {
      command.execute(...args)
    }
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id)
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values())
  }
}

// Global instance
export const globalCommandRegistry = new CommandRegistry()
```

### Command Structure

Each command follows this interface:

```typescript
export interface Command {
  // Unique identifier (kebab-case)
  id: string

  // Display name (shown in command palette)
  name: string

  // Optional description
  description?: string

  // Group for organization ('file', 'edit', 'navigation', etc.)
  group: CommandGroup

  // Optional keyboard shortcut hint
  shortcut?: string

  // Optional icon
  icon?: React.ComponentType

  // Execution function
  execute: (...args: unknown[]) => void | Promise<void>

  // Optional availability check
  isAvailable?: () => boolean
}

// Command groups for organization
export type CommandGroup =
  | 'file'
  | 'edit'
  | 'navigation'
  | 'view'
  | 'formatting'
  | 'help'
```

## Registering Commands

### When to Register

Commands are registered during application initialization, before any UI renders.

### Where to Register

Commands are defined in feature-specific files and registered in the central registry:

```
lib/commands/
├── CommandRegistry.ts    # Core registry implementation
├── types.ts              # Command interfaces
├── app-commands.ts       # Application-level commands (new, save, close)
├── editor-commands.ts    # Editor formatting commands (bold, italic, heading)
├── navigation-commands.ts # Navigation commands (sidebar, focus mode)
└── index.ts              # Exports and registration
```

### Registration Pattern

```typescript
// lib/commands/editor-commands.ts
import { Command } from './types'
import { useEditorStore } from '@/store/editorStore'

export const toggleBoldCommand: Command = {
  id: 'toggle-bold',
  name: 'Toggle Bold',
  description: 'Make selected text bold',
  group: 'formatting',
  shortcut: 'Cmd+B',
  execute: () => {
    const { editorView } = useEditorStore.getState()
    if (editorView) {
      // Execute CodeMirror command
      toggleBold(editorView)
    }
  },
  isAvailable: () => {
    const { currentFile } = useEditorStore.getState()
    return currentFile !== null
  }
}

export const formatHeadingCommand: Command = {
  id: 'format-heading',
  name: 'Format as Heading',
  description: 'Format line as heading (H1-H6)',
  group: 'formatting',
  execute: (level: number) => {
    const { editorView } = useEditorStore.getState()
    if (editorView && level >= 1 && level <= 6) {
      formatHeading(editorView, level)
    }
  },
  isAvailable: () => {
    const { currentFile } = useEditorStore.getState()
    return currentFile !== null
  }
}
```

```typescript
// lib/commands/index.ts
import { globalCommandRegistry } from './CommandRegistry'
import { toggleBoldCommand, formatHeadingCommand } from './editor-commands'
import { saveFileCommand, newFileCommand } from './app-commands'
import { toggleSidebarCommand } from './navigation-commands'

// Register all commands at app startup
export function registerAllCommands(): void {
  // Editor commands
  globalCommandRegistry.register(toggleBoldCommand)
  globalCommandRegistry.register(formatHeadingCommand)

  // App commands
  globalCommandRegistry.register(saveFileCommand)
  globalCommandRegistry.register(newFileCommand)

  // Navigation commands
  globalCommandRegistry.register(toggleSidebarCommand)
}

// Export for use in app
export { globalCommandRegistry } from './CommandRegistry'
export type { Command, CommandGroup } from './types'
```

### Initialization in App

```typescript
// App.tsx
import { registerAllCommands } from '@/lib/commands'

function App() {
  useEffect(() => {
    // Register commands before rendering UI
    registerAllCommands()
  }, [])

  return <Layout />
}
```

## Executing Commands

Commands can be executed from multiple integration points:

### 1. From Keyboard Shortcuts

```typescript
// hooks/useKeyboardShortcuts.ts
import { useHotkeys } from 'react-hotkeys-hook'
import { globalCommandRegistry } from '@/lib/commands'

export function useKeyboardShortcuts() {
  // Save file
  useHotkeys('mod+s', (e) => {
    e.preventDefault()
    globalCommandRegistry.execute('save-file')
  })

  // Toggle bold
  useHotkeys('mod+b', (e) => {
    e.preventDefault()
    globalCommandRegistry.execute('toggle-bold')
  })

  // Format as H1
  useHotkeys('mod+shift+1', (e) => {
    e.preventDefault()
    globalCommandRegistry.execute('format-heading', 1)
  })
}
```

### 2. From Native Menus

Native menus emit Tauri events that map to commands:

```typescript
// components/layout/Layout.tsx
import { listen } from '@tauri-apps/api/event'
import { globalCommandRegistry } from '@/lib/commands'

export const Layout = () => {
  useEffect(() => {
    // Listen for menu events from Tauri
    const unlisten = listen('menu-save', () => {
      globalCommandRegistry.execute('save-file')
    })

    const unlisten2 = listen('menu-format-bold', () => {
      globalCommandRegistry.execute('toggle-bold')
    })

    return () => {
      unlisten.then(fn => fn())
      unlisten2.then(fn => fn())
    }
  }, [])

  return <MainLayout />
}
```

**Tauri Menu Configuration**:
```rust
// src-tauri/src/menu.rs
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

pub fn create_menu() -> Menu {
    let save = CustomMenuItem::new("save".to_string(), "Save")
        .accelerator("CmdOrCtrl+S");

    let format_bold = CustomMenuItem::new("format-bold".to_string(), "Bold")
        .accelerator("CmdOrCtrl+B");

    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(save)
    );

    let format_menu = Submenu::new(
        "Format",
        Menu::new()
            .add_item(format_bold)
    );

    Menu::new()
        .add_submenu(file_menu)
        .add_submenu(format_menu)
}
```

### 3. From Command Palette

The command palette shows all available commands with search:

```typescript
// components/CommandPalette.tsx
import { globalCommandRegistry } from '@/lib/commands'

export const CommandPalette = () => {
  const [query, setQuery] = useState('')

  // Get all available commands
  const commands = globalCommandRegistry
    .getAllCommands()
    .filter(cmd => cmd.isAvailable?.() ?? true)
    .filter(cmd =>
      cmd.name.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase())
    )

  const handleSelect = (commandId: string) => {
    globalCommandRegistry.execute(commandId)
    onClose()
  }

  return (
    <CommandDialog>
      <CommandInput
        placeholder="Type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {commands.map(cmd => (
          <CommandItem
            key={cmd.id}
            onSelect={() => handleSelect(cmd.id)}
          >
            {cmd.icon && <cmd.icon />}
            <span>{cmd.name}</span>
            {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
```

### 4. From UI Components

Direct execution from buttons, toolbar items, etc.:

```typescript
// components/layout/UnifiedTitleBar.tsx
import { globalCommandRegistry } from '@/lib/commands'

export const UnifiedTitleBar = () => {
  return (
    <div>
      <Button onClick={() => globalCommandRegistry.execute('save-file')}>
        <Save className="size-4" />
      </Button>

      <Button onClick={() => globalCommandRegistry.execute('toggle-sidebar')}>
        <PanelLeft className="size-4" />
      </Button>
    </div>
  )
}
```

### Commands with Parameters

Some commands accept parameters:

```typescript
// Execute with arguments
globalCommandRegistry.execute('format-heading', 1) // H1
globalCommandRegistry.execute('format-heading', 2) // H2
globalCommandRegistry.execute('insert-link', 'https://example.com', 'Example')
```

## The getState() Pattern in Commands (CRITICAL)

**Problem**: Commands can't use React hooks but need access to application state.

**Solution**: Use `getState()` to access Zustand stores without hooks.

### Why getState() in Commands?

Commands are defined in `lib/commands/` which:
- **Cannot use React hooks** (not React components)
- **Need current state** to determine behavior
- **Execute asynchronously** (state might change during execution)

### Pattern: Access Store in Execute Function

```typescript
// ✅ CORRECT: Use getState() in execute
export const saveFileCommand: Command = {
  id: 'save-file',
  name: 'Save File',
  execute: async () => {
    // Get latest state at execution time
    const { currentFile, isDirty, saveFile } = useEditorStore.getState()

    if (!currentFile) {
      toast.error('No file open')
      return
    }

    if (!isDirty) {
      toast.info('No changes to save')
      return
    }

    await saveFile()
    toast.success('File saved')
  },
  isAvailable: () => {
    // Also use getState() for availability check
    const { currentFile, isDirty } = useEditorStore.getState()
    return currentFile !== null && isDirty
  }
}
```

### ❌ Wrong: Trying to Use Hooks

```typescript
// ❌ WRONG: Can't use hooks outside React components
export const badCommand: Command = {
  id: 'bad-command',
  execute: () => {
    // ERROR: Invalid hook call!
    const { currentFile } = useEditorStore()
  }
}
```

### Multiple Stores in Commands

Commands often need state from multiple stores:

```typescript
export const createNewFileCommand: Command = {
  id: 'create-new-file',
  name: 'New File',
  execute: async () => {
    // Access multiple stores with getState()
    const { selectedCollection } = useProjectStore.getState()
    const { currentProjectSettings } = useProjectStore.getState()
    const { openFile } = useEditorStore.getState()

    if (!selectedCollection) {
      toast.error('Please select a collection first')
      return
    }

    // Create file using collection context
    const newFile = await createFile(selectedCollection, currentProjectSettings)
    openFile(newFile)
    toast.success('File created')
  },
  isAvailable: () => {
    const { selectedCollection } = useProjectStore.getState()
    return selectedCollection !== null
  }
}
```

## Integration Points

### Integration 1: Keyboard Shortcuts

**File**: `src/hooks/useKeyboardShortcuts.ts`

Maps keyboard combinations to command execution:

```typescript
useHotkeys('mod+s', () => globalCommandRegistry.execute('save-file'))
useHotkeys('mod+b', () => globalCommandRegistry.execute('toggle-bold'))
useHotkeys('mod+i', () => globalCommandRegistry.execute('toggle-italic'))
```

📖 **See [keyboard-shortcuts.md](./keyboard-shortcuts.md) for implementation details**

### Integration 2: Native Menus

**File**: `src-tauri/src/menu.rs` (Rust) + `Layout.tsx` (React)

Native menus emit Tauri events → React listens → Executes commands:

```typescript
// Layout.tsx
useEffect(() => {
  listen('menu-save', () => globalCommandRegistry.execute('save-file'))
  listen('menu-format-bold', () => globalCommandRegistry.execute('toggle-bold'))
}, [])
```

### Integration 3: Command Palette

**File**: `src/components/CommandPalette.tsx`

Shows all available commands, filters by search, executes on selection:

```typescript
const commands = globalCommandRegistry
  .getAllCommands()
  .filter(cmd => cmd.isAvailable?.() ?? true)

const handleSelect = (commandId: string) => {
  globalCommandRegistry.execute(commandId)
}
```

### Integration 4: Toolbar & UI

**Files**: `UnifiedTitleBar.tsx`, buttons, menus

Direct execution from click handlers:

```typescript
<Button onClick={() => globalCommandRegistry.execute('save-file')}>
  Save
</Button>
```

## Adding New Commands

### Step-by-Step Guide

#### 1. Define the Command

Create command in appropriate file (e.g., `editor-commands.ts`):

```typescript
// lib/commands/editor-commands.ts
export const insertLinkCommand: Command = {
  id: 'insert-link',
  name: 'Insert Link',
  description: 'Insert a markdown link',
  group: 'formatting',
  shortcut: 'Cmd+K',
  execute: (url?: string, text?: string) => {
    const { editorView } = useEditorStore.getState()

    if (!editorView) return

    if (url && text) {
      // Called with parameters (from UI form)
      insertLink(editorView, url, text)
    } else {
      // Called without parameters (from shortcut)
      // Could prompt user for input
      const selectedText = getSelectedText(editorView)
      insertLink(editorView, '', selectedText)
    }
  },
  isAvailable: () => {
    const { currentFile } = useEditorStore.getState()
    return currentFile !== null
  }
}
```

#### 2. Register the Command

Add to registration in `index.ts`:

```typescript
// lib/commands/index.ts
import { insertLinkCommand } from './editor-commands'

export function registerAllCommands(): void {
  // ... existing commands
  globalCommandRegistry.register(insertLinkCommand)
}
```

#### 3. Add Keyboard Shortcut (Optional)

If command should have a keyboard shortcut:

```typescript
// hooks/useKeyboardShortcuts.ts
useHotkeys('mod+k', (e) => {
  e.preventDefault()
  globalCommandRegistry.execute('insert-link')
})
```

#### 4. Add Native Menu Item (Optional)

If command should appear in native menu:

```rust
// src-tauri/src/menu.rs
let insert_link = CustomMenuItem::new("insert-link", "Insert Link")
    .accelerator("CmdOrCtrl+K");

let format_menu = Submenu::new(
    "Format",
    Menu::new()
        .add_item(insert_link)
);
```

```typescript
// Layout.tsx
listen('menu-insert-link', () => {
  globalCommandRegistry.execute('insert-link')
})
```

#### 5. Test the Command

Write tests for command execution:

```typescript
// lib/commands/editor-commands.test.ts
describe('insertLinkCommand', () => {
  it('inserts link with URL and text', () => {
    const mockView = createMockEditorView()
    useEditorStore.setState({ editorView: mockView })

    insertLinkCommand.execute('https://example.com', 'Example')

    expect(mockView.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({
            insert: '[Example](https://example.com)'
          })
        ])
      })
    )
  })

  it('not available when no file open', () => {
    useEditorStore.setState({ currentFile: null })

    expect(insertLinkCommand.isAvailable?.()).toBe(false)
  })
})
```

### Command Checklist

When adding a new command:
- [ ] Define command with all required properties
- [ ] Implement execute function with getState()
- [ ] Add isAvailable check if needed
- [ ] Register in index.ts
- [ ] Add keyboard shortcut if applicable
- [ ] Add native menu item if applicable
- [ ] Update command palette groups if new group
- [ ] Write tests for execute and isAvailable
- [ ] Document command behavior
- [ ] Test from all integration points

## Real Examples from Astro Editor

### Example 1: Save File

```typescript
export const saveFileCommand: Command = {
  id: 'save-file',
  name: 'Save File',
  description: 'Save the current file',
  group: 'file',
  shortcut: 'Cmd+S',
  execute: async () => {
    const { currentFile, isDirty, saveFile } = useEditorStore.getState()

    if (!currentFile) {
      toast.error('No file open')
      return
    }

    if (!isDirty) {
      toast.info('No changes to save')
      return
    }

    await saveFile()
    toast.success('File saved')
  },
  isAvailable: () => {
    const { currentFile, isDirty } = useEditorStore.getState()
    return currentFile !== null && isDirty
  }
}
```

**Integrated via**:
- Keyboard: `Cmd+S` → `useKeyboardShortcuts.ts`
- Menu: File → Save → `menu-save` event
- Toolbar: Save button → direct execution
- Command Palette: "Save File"

### Example 2: Toggle Bold

```typescript
export const toggleBoldCommand: Command = {
  id: 'toggle-bold',
  name: 'Toggle Bold',
  description: 'Make selected text bold',
  group: 'formatting',
  shortcut: 'Cmd+B',
  execute: () => {
    const { editorView } = useEditorStore.getState()

    if (!editorView) return

    // CodeMirror transaction
    const from = editorView.state.selection.main.from
    const to = editorView.state.selection.main.to
    const selectedText = editorView.state.sliceDoc(from, to)

    if (selectedText) {
      const boldText = `**${selectedText}**`
      editorView.dispatch({
        changes: { from, to, insert: boldText },
        selection: { anchor: from + 2, head: to + 2 }
      })
    }
  },
  isAvailable: () => {
    const { currentFile, editorView } = useEditorStore.getState()
    return currentFile !== null && editorView !== null
  }
}
```

**Integrated via**:
- Keyboard: `Cmd+B` → `useKeyboardShortcuts.ts`
- Menu: Format → Bold → `menu-format-bold` event
- Command Palette: "Toggle Bold"

### Example 3: Format Heading

```typescript
export const formatHeadingCommand: Command = {
  id: 'format-heading',
  name: 'Format as Heading',
  description: 'Format line as heading (H1-H6)',
  group: 'formatting',
  execute: (level: number) => {
    const { editorView } = useEditorStore.getState()

    if (!editorView || level < 1 || level > 6) return

    const pos = editorView.state.selection.main.head
    const line = editorView.state.doc.lineAt(pos)
    const lineText = line.text

    // Remove existing heading markers
    const cleanText = lineText.replace(/^#+\s*/, '')

    // Add new heading markers
    const headingText = `${'#'.repeat(level)} ${cleanText}`

    editorView.dispatch({
      changes: { from: line.from, to: line.to, insert: headingText },
      selection: { anchor: line.from + level + 1 }
    })
  },
  isAvailable: () => {
    const { currentFile, editorView } = useEditorStore.getState()
    return currentFile !== null && editorView !== null
  }
}
```

**Integrated via**:
- Keyboard: `Cmd+Shift+1` through `Cmd+Shift+6` → executes with level parameter
- Command Palette: "Format as Heading" → prompts for level
- Context menu: Right-click → Heading → H1-H6 → executes with level

### Example 4: Toggle Sidebar

```typescript
export const toggleSidebarCommand: Command = {
  id: 'toggle-sidebar',
  name: 'Toggle Sidebar',
  description: 'Show or hide the file sidebar',
  group: 'view',
  shortcut: 'Cmd+1',
  execute: () => {
    const { toggleSidebar } = useUIStore.getState()
    toggleSidebar()
  }
}
```

**Integrated via**:
- Keyboard: `Cmd+1` → `useKeyboardShortcuts.ts`
- Toolbar: Sidebar toggle button → direct execution
- Menu: View → Toggle Sidebar → `menu-toggle-sidebar` event
- Command Palette: "Toggle Sidebar"

## Command Groups

Commands are organized into logical groups:

```typescript
export type CommandGroup =
  | 'file'        // File operations (new, open, save, close)
  | 'edit'        // Edit operations (cut, copy, paste, undo)
  | 'navigation'  // Navigation (go to file, search)
  | 'view'        // View controls (toggle sidebar, focus mode)
  | 'formatting'  // Text formatting (bold, italic, heading)
  | 'help'        // Help and documentation

// Commands are grouped in command palette
const commandsByGroup = {
  file: commands.filter(c => c.group === 'file'),
  edit: commands.filter(c => c.group === 'edit'),
  // ... etc
}
```

## Best Practices

### Do ✅

1. **Use getState() in commands** - Commands can't use hooks
2. **Check availability** - Disable commands when not applicable
3. **Provide user feedback** - Use toast notifications
4. **Keep execute functions focused** - Delegate to lib/ modules
5. **Use descriptive names** - Clear, action-oriented names
6. **Group logically** - Organize by feature area
7. **Test thoroughly** - Test execute and availability independently

### Don't ❌

1. **Don't use hooks in commands** - Use getState() instead
2. **Don't put business logic in commands** - Delegate to lib/ modules
3. **Don't duplicate logic** - That's the whole point of commands!
4. **Don't forget availability checks** - Prevent invalid executions
5. **Don't skip user feedback** - Always inform user of result
6. **Don't hardcode shortcuts in commands** - Document them separately
7. **Don't mix concerns** - Keep commands simple and focused

## Troubleshooting

### Command Not Executing

**Check**:
1. Is command registered in `registerAllCommands()`?
2. Is `isAvailable()` returning `true`?
3. Is command ID spelled correctly?
4. Are there console errors?

### Command Executes But No Effect

**Check**:
1. Is getState() getting the correct store?
2. Is the store state what you expect?
3. Is the execute logic correct?
4. Are there any errors being swallowed?

### Command Not in Palette

**Check**:
1. Is command registered?
2. Is `isAvailable()` returning `true`?
3. Is command group correct?
4. Is command palette filtering it out?

### Keyboard Shortcut Not Working

**Check**:
1. Is shortcut registered in `useKeyboardShortcuts.ts`?
2. Is command ID correct?
3. Is shortcut conflicting with browser/OS shortcuts?
4. Is `preventDefault()` called?

## Related Documentation

- [architecture-guide.md](./architecture-guide.md) - Overview of command pattern in context
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) - Keyboard shortcut implementation
- [state-management.md](./state-management.md) - Understanding getState() pattern
- [performance-patterns.md](./performance-patterns.md) - Performance optimization

---

**Remember**: The command pattern creates a single source of truth for all user actions. Define once, execute everywhere. Use `getState()` to access state without hooks, and always check availability before execution.
