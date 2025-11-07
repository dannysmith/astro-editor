# Architecture Guide

## Overview

This document covers the core architectural patterns and principles used in Astro Editor. It focuses on the **essential patterns you need daily**. For specialized topics, see the [Specialized Guides](#specialized-guides) section.

## Core Architecture Principles

### 1. Separation of Concerns

The codebase maintains clear boundaries between different types of concerns:

- **Business Logic**: Lives in decomposed Zustand stores (`src/store/`)
- **Server State**: Managed by TanStack Query (`hooks/queries/`, `hooks/mutations/`)
- **UI Orchestration**: Container components (e.g., `Layout.tsx`)
- **Editor Logic**: Isolated modules in `src/lib/editor/`
- **Reusable UI Logic**: Custom hooks in `src/hooks/`
- **Pure UI Components**:
  - `src/components/ui/`: shadcn/ui components
  - `src/components/tauri/`: Tauri-specific shared components

#### Directory Purpose and Boundaries

The codebase enforces clear boundaries between different directory types to maintain separation of concerns:

| Directory | Purpose | Can Import From | Cannot Import From | Exports |
|-----------|---------|-----------------|-------------------|---------|
| `lib/` | Pure business logic, utilities, classes | Other lib modules | store (except getState), hooks | Functions, classes, types |
| `hooks/` | React hooks, lifecycle logic | lib, store | - | Hooks |
| `store/` | Zustand state management | lib (for utilities) | hooks | Stores (which are hooks) |

**Rule:** If a module exports a React hook (`use*`), it belongs in `hooks/`, not `lib/`.

**Exception:** Context providers (ThemeProvider, QueryClientProvider) can live in lib/ if they're framework integrations.

**Example of getState() pattern (acceptable):**
```typescript
// lib/ide.ts - This is OK
export async function openInIde(filePath: string) {
  const ideCommand = useProjectStore.getState().globalSettings?.general?.ideCommand
  // One-way call, no React coupling
}
```

**Example of hook in lib (violation):**
```typescript
// lib/commands/command-context.ts - WRONG
export function useCommandContext() {
  const { currentFile } = useEditorStore() // This is a React hook!
  // Should be in hooks/commands/useCommandContext.ts
}
```

### 2. State Management Philosophy

We use a **hybrid approach** with clear responsibilities based on data source and persistence needs.

**The "Onion Pattern"**: State management has three layers, from outer to inner:

1. **TanStack Query** (outermost): Data from external sources (filesystem, server)
2. **Zustand** (middle): Application state that needs to persist across components
3. **useState** (innermost): Transient UI state local to a component

**Decision Rules**:

```
Is the data from filesystem/server? → TanStack Query
  ↓ No
Does it need to persist across components? → Zustand
  ↓ No
Is it just UI presentation state? → useState (local)
```

**Quick Overview**:

- **TanStack Query**: Collections, files, file content from filesystem
- **Zustand**: Three decomposed stores (editorStore, projectStore, uiStore) for performance
- **Local useState**: Hover states, temporary UI flags, derived values

📖 **For comprehensive coverage of state management including store decomposition strategy, getState() pattern, bridge pattern details, and extensive examples, see [state-management.md](./state-management.md)**

### 3. Module Organization

#### When to Create a Module (`lib/`)

Extract code into `lib/` when:
1. It's a distinct feature with 3+ functions
2. It's used by multiple components
3. It has complex logic that benefits from isolation
4. It could be tested independently

```
commands/
├── index.ts           # Public exports
├── types.ts           # Interfaces
├── CommandRegistry.ts # Core implementation
├── editorCommands.ts  # Command definitions
└── menuIntegration.ts # Menu-specific logic
```

#### When to Create a Hook (`hooks/`)

Extract to `src/hooks/` when:
1. Logic uses React hooks internally
2. Tightly coupled to React lifecycle
3. Same logic needed in multiple components
4. Manages side effects (subscriptions, timers, etc.)

#### Shared File Processing Module

The `src/lib/files/` module demonstrates good module organization for shared business logic:

```
files/
├── index.ts              # Public API exports
├── types.ts              # TypeScript interfaces
├── constants.ts          # IMAGE_EXTENSIONS
├── fileProcessing.ts     # Core business logic
└── fileProcessing.test.ts # Comprehensive tests
```

**Core Function: `processFileToAssets()`**

Centralizes file copying logic with configurable behavior via strategy pattern:

```typescript
import { processFileToAssets } from '@/lib/files'

// Strategy 1: Always copy (editor drag-and-drop)
const result = await processFileToAssets({
  sourcePath: filePath,
  projectPath,
  collection,
  projectSettings: currentProjectSettings,
  copyStrategy: 'always', // Always copies to assets directory
})

// Strategy 2: Only if outside project (ImageField)
const result = await processFileToAssets({
  sourcePath: filePath,
  projectPath,
  collection,
  projectSettings: currentProjectSettings,
  copyStrategy: 'only-if-outside-project', // Conditionally copies
})

// Returns normalized path and metadata
console.log(result.relativePath) // '/assets/collection/image.png'
console.log(result.wasCopied)    // true/false
console.log(result.filename)     // 'image.png'
```

**Strategy Pattern Benefits**:
- **Single source of truth**: Eliminates code duplication (removed 125+ duplicate lines)
- **Configurable behavior**: Same function serves different use cases
- **Separation of concerns**: Business logic isolated from UI logic
- **Testable**: Pure functions with comprehensive test coverage

**When to use each strategy**:
- `'always'`: When user explicitly adds files (drag-and-drop, paste)
- `'only-if-outside-project'`: When files might already be in project (manual path edits, existing references)

**UI-specific logic stays in components**:
- Markdown formatting (`formatAsMarkdown`)
- Toast notifications
- React state management

#### Other Key Utility Modules

**Date Utilities (`src/lib/dates.ts`)**

```typescript
import { formatIsoDate, todayIsoDate } from '@/lib/dates'

const isoDate = formatIsoDate(new Date())  // "2025-11-01"
const today = todayIsoDate()                // Today's date in YYYY-MM-DD
```

**IDE Integration (`src/lib/ide.ts`)**

```typescript
import { openInIde } from '@/lib/ide'

// Opens file in configured IDE with unified error handling
await openInIde(filePath, ideCommand)
```

**Project Actions (`src/lib/projects/actions.ts`)**

```typescript
import { openProjectViaDialog } from '@/lib/projects/actions'

// Unified project selection dialog with error handling
await openProjectViaDialog()
```

**Field Constants (`src/components/frontmatter/fields/constants.ts`)**

```typescript
import { NONE_SENTINEL } from '@/components/frontmatter/fields/constants'

// Use for "no selection" values in dropdowns
<SelectItem value={NONE_SENTINEL}>
  <span className="text-muted-foreground">(None)</span>
</SelectItem>
```

## Critical Patterns

### The `getState()` Pattern (CRITICAL)

**Problem**: Subscribing to store values in callbacks creates render cascades.

**Solution**: Use `getState()` to access current values without subscribing.

```typescript
// ❌ BAD: Causes render cascade
const { currentFile, isDirty, saveFile } = useEditorStore()

const handleSave = useCallback(() => {
  if (currentFile && isDirty) {
    void saveFile()
  }
}, [currentFile, isDirty, saveFile]) // Re-creates on every keystroke!

// ✅ GOOD: No cascade
const handleSave = useCallback(() => {
  const { currentFile, isDirty, saveFile } = useEditorStore.getState()
  if (currentFile && isDirty) {
    void saveFile()
  }
}, []) // Stable dependency array
```

**When to use getState()**:
- In `useCallback` dependencies when you need current state but don't want re-renders
- In event handlers for accessing latest state without subscriptions
- In `useEffect` with empty dependencies
- In async operations when state might change during execution

📖 **See [performance-patterns.md](./performance-patterns.md) for comprehensive performance patterns**

### Direct Store Pattern (CRITICAL)

**Problem**: React Hook Form + Zustand causes infinite render loops.

**Solution**: Components access store directly without callback props.

```typescript
// ✅ CORRECT: Direct store pattern
const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  return (
    <FieldWrapper label={label} required={required}>
      <Input
        value={frontmatter[name] || ''}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </FieldWrapper>
  )
}

// ❌ WRONG: Callback dependencies cause infinite loops
const BadField: React.FC<{ onChange: (value: string) => void }> = ({
  onChange,
}) => {
  return <Input onChange={e => onChange(e.target.value)} />
}
```

📖 **See [form-patterns.md](./form-patterns.md) for complete form component patterns**

### Command Pattern

The editor uses a command registry pattern to centralize all user-triggered actions:

```typescript
// Global registry instance
export const globalCommandRegistry = new CommandRegistry()

// Execute commands from anywhere
globalCommandRegistry.execute('save-file')
globalCommandRegistry.execute('toggle-bold')
globalCommandRegistry.execute('format-heading', 1)
```

**Why Commands?**
- **Single source of truth**: Logic defined once, used by keyboard shortcuts, menus, buttons, and command palette
- **Consistency**: Same behavior from all triggers
- **Discoverability**: Command palette shows all available actions
- **getState() pattern**: Commands can't use hooks, so they use `getState()` to access stores

**Basic Integration**:
- Keyboard shortcuts execute commands via `react-hotkeys-hook`
- Native menus emit Tauri events → Layout listens → Executes commands
- Command palette (Cmd+K) lists and executes commands
- UI buttons call commands directly

📖 **For detailed command implementation including registration, integration with keyboard shortcuts and menus, command structure, and examples, see [command-system.md](./command-system.md)**

### TanStack Query Patterns

#### Query Keys Factory

Centralize query keys for consistency:

```typescript
// lib/query-keys.ts
export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
  fileContent: (projectPath: string, fileId: string) =>
    [...queryKeys.all, projectPath, 'files', fileId] as const,
}
```

#### Automatic Cache Invalidation

```typescript
export const useSaveFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveFile,
    onSuccess: (_, variables) => {
      // Invalidate to update UI
      queryClient.invalidateQueries({
        queryKey: queryKeys.collectionFiles(
          variables.projectPath,
          variables.collectionName
        ),
      })
    },
  })
}
```

#### Hybrid Action Hooks Pattern (Standard)

When actions need both store state and query data, use the Hybrid Action Hooks pattern:

**Pattern**: User-triggered actions in hooks, state-triggered actions in stores with callbacks.

```typescript
// 1. Hook (user-triggered actions with direct query access)
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async () => {
    const { currentFile, editorContent } = useEditorStore.getState() // Store access
    const collections = queryClient.getQueryData(queryKeys.collections()) // Query access
    // ... save logic
  }, [queryClient])

  return { saveFile }
}

// 2. Store (state-triggered actions via registered callbacks)
const useEditorStore = create((set, get) => ({
  autoSaveCallback: null,
  setAutoSaveCallback: callback => set({ autoSaveCallback: callback }),

  setEditorContent: content => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave() // State-triggered
  },

  scheduleAutoSave: () => {
    const { autoSaveCallback } = get()
    if (autoSaveCallback) {
      setTimeout(() => void autoSaveCallback(), 2000)
    }
  },
}))

// 3. Layout (wires them together)
const { saveFile } = useEditorActions()
useEffect(() => {
  useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
}, [saveFile])
```

**Benefits**: Synchronous data access (no polling), type-safe, easy to test and debug.

### Event-Driven Communication

The app uses multiple event systems for different purposes:

1. **Tauri Events**: Native menu/OS integration (`listen('menu-format-bold', ...)`)
2. **Custom DOM Events**: Component communication (`window.dispatchEvent(...)`)
3. **CodeMirror Transactions**: Editor state changes
4. **Zustand Subscriptions**: Store changes (`useEditorStore.subscribe(...)`)

## Performance Essentials

### Critical Anti-Patterns to Avoid

1. ❌ **Subscribing to frequently-changing data** in components that don't need to re-render
2. ❌ **Using objects as dependencies** in useCallback/useEffect
3. ❌ **Conditional rendering** of complex stateful components
4. ❌ **Function dependencies** in useEffect (use `getState()` instead)
5. ❌ **Object destructuring** from stores for frequently-changing data

### CSS Visibility vs Conditional Rendering

For stateful components (like ResizablePanel), use CSS visibility to preserve state:

```typescript
// ✅ GOOD: Preserves component state
<ResizablePanel
  className={cn('base-styles', visible ? '' : 'hidden')}
>
  Content
</ResizablePanel>

// ❌ BAD: Loses state on every toggle
{visible && <ResizablePanel>Content</ResizablePanel>}
```

### Quick Performance Checklist

- [ ] Use `getState()` in callbacks to avoid render cascades
- [ ] Subscribe only to data that should trigger re-renders
- [ ] Use CSS visibility for togglable stateful components
- [ ] Avoid object destructuring for frequently-changing state
- [ ] Debounce expensive operations (auto-save uses 2s)

📖 **See [performance-patterns.md](./performance-patterns.md) for detailed patterns and optimization strategies**

## Component Organization

### Directory Structure

```
src/components/
├── ui/                 # shadcn/ui components (Button, Input, etc.)
├── tauri/              # Tauri-specific shared components
│   ├── FileUploadButton.tsx
│   └── index.ts
├── layout/             # Layout orchestration
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   └── MainEditor.tsx
├── frontmatter/        # Frontmatter panel
│   ├── fields/         # Field components
│   └── FrontmatterPanel.tsx
└── editor/             # Editor components
```

### Tauri Component Pattern

Place components in `src/components/tauri/` when they:
1. Use Tauri-specific APIs (`@tauri-apps/api`, `@tauri-apps/plugin-*`)
2. Are general-purpose and reusable across features
3. Handle native system integration (file dialogs, drag-drop)

```typescript
// src/components/tauri/index.ts
export { FileUploadButton } from './FileUploadButton'
export type { FileUploadButtonProps } from './FileUploadButton'
```

## Testing Strategy

### What to Test

- ✅ Business logic and algorithms (unit tests)
- ✅ Complex state management (integration tests)
- ✅ User interactions (component tests)
- ✅ Edge cases and error handling

### What NOT to Test

- ❌ Simple UI rendering
- ❌ Third-party library internals
- ❌ Trivial getters/setters

### Test Types

1. **Unit Tests**: Individual functions and modules in `lib/`
2. **Integration Tests**: How multiple units work together (hooks, stores)
3. **Component Tests**: User interactions and workflows

📖 **See [testing.md](./testing.md) for comprehensive testing strategies**

## Common Pitfalls

1. **Don't mix concerns**: Keep business logic out of components
2. **Don't bypass the store**: All business state changes go through Zustand
3. **Don't create circular dependencies**: Use index.ts exports
4. **Don't use React Hook Form**: Use Direct Store Pattern instead
5. **Don't subscribe in callbacks**: Use `getState()` pattern
6. **Don't ignore TypeScript**: Leverage types for safety

## Quick Reference

### When to Extract Code

**Extract to `lib/`** when:
- 50+ lines of related logic
- Used by 2+ components
- Needs unit tests
- Contains domain logic

**Extract to `hooks/`** when:
- Uses React hooks internally
- Coupled to React lifecycle
- Shared behavior between components
- Manages side effects

### Code Organization Checklist

- [ ] Business logic in `lib/` modules
- [ ] Reusable UI logic in custom hooks
- [ ] Server state with TanStack Query
- [ ] Client state with appropriate Zustand store
- [ ] Pure UI in components
- [ ] Tests alongside implementation

## External API Requests

**When adding `fetch()` calls to external domains from frontend code**, add the domain to the `connect-src` CSP directive in `src-tauri/tauri.conf.json`:

```json
"csp": "... connect-src 'self' https://api.example.com; ..."
```

Use origin only (not full paths). Rust backend requests are not affected by CSP.

## Module Dependencies (Simplified)

```
App
├── QueryClientProvider (TanStack Query)
│   └── Layout (orchestrator)
│       ├── Sidebar
│       │   ├── useCollectionsQuery (server state)
│       │   └── useProjectStore (client state)
│       ├── MainEditor
│       │   ├── Editor
│       │   │   ├── useEditorStore (client state)
│       │   │   └── lib/editor/* (business logic)
│       │   └── StatusBar
│       └── FrontmatterPanel
│           ├── useCollectionsQuery (server state)
│           └── useEditorStore (client state)
├── Zustand Stores (client state):
│   ├── editorStore (file editing)
│   ├── projectStore (project-level)
│   └── uiStore (UI layout)
└── Tauri Commands (Rust backend)
```

## Specialized Guides

For in-depth coverage of specific topics, see these guides:

**Core Architecture**:
- **[state-management.md](./state-management.md)**: Deep dive into the "Onion" pattern, store decomposition, and getState() usage
- **[command-system.md](./command-system.md)**: Command pattern implementation, registration, and integration
- **[ui-patterns.md](./ui-patterns.md)**: Common UI patterns and shadcn/ui best practices
- **[performance-patterns.md](./performance-patterns.md)**: Comprehensive performance optimization patterns
- **[testing.md](./testing.md)**: Testing strategies and patterns
- **[optimization.md](./optimization.md)**: Bundle optimization and performance budgets

**System Documentation**:
- **[form-patterns.md](./form-patterns.md)**: Frontmatter fields and settings forms
- **[schema-system.md](./schema-system.md)**: Rust-based schema parsing and merging
- **[keyboard-shortcuts.md](./keyboard-shortcuts.md)**: Keyboard shortcut implementation
- **[preferences-system.md](./preferences-system.md)**: Settings hierarchy and management
- **[color-system.md](./color-system.md)**: Color tokens and theming
- **[notifications.md](./notifications.md)**: Notification system
- **[editor-styles.md](./editor-styles.md)**: Custom syntax highlighting

**Reference**:
- **[decisions.md](./decisions.md)**: Architectural decisions and trade-offs

## Quick Start for New Sessions

1. **Read** `docs/TASKS.md` for current work
2. **Check** git status and recent commits
3. **Reference** this guide for core patterns
4. **Consult** specialized guides when working on specific features
5. **Follow** established patterns - don't reinvent
6. **Test** changes thoroughly
7. **Run** `pnpm run check:all` before committing

---

**Remember**: This architecture ensures clear data flow, testable modules, and performance optimization through targeted re-renders. When in doubt, follow the patterns demonstrated in existing code and consult the specialized guides.
