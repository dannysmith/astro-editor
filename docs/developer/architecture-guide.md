# Architecture Guide

## Overview

This document details the architectural patterns and principles used in the Astro Editor. It serves as a reference for maintaining consistency and understanding the reasoning behind key design decisions.

## Core Architecture Principles

### 1. Separation of Concerns

The codebase follows a clear separation between different types of concerns:

- **Business Logic**: Lives in decomposed Zustand stores (`src/store/`)
- **UI Orchestration**: Managed by container components (e.g., `Layout.tsx`)
- **Editor Logic**: Isolated in `src/lib/editor/` modules
- **Reusable UI Logic**: Extracted to `src/hooks/`
- **Pure UI Components**: In `src/components/`

### 2. State Management Philosophy

We use a hybrid approach with TanStack Query and Zustand:

#### Server State (TanStack Query)

Use TanStack Query for state that:

- Comes from the server/filesystem (collections, files, file content)
- Benefits from caching and automatic refetching
- Needs to be synchronized across components
- Has loading, error, and success states

Examples:

```typescript
// Server state managed by TanStack Query
const { data: collections } = useCollectionsQuery(projectPath)
const { data: files } = useCollectionFilesQuery(projectPath, collectionName)
const { data: content } = useFileContentQuery(projectPath, fileId)
```

#### Client State (Zustand)

We use a **decomposed store architecture** with three focused stores:

**1. Editor Store (`useEditorStore`)** - File editing state (most volatile):

```typescript
// src/store/editorStore.ts
currentFile: FileEntry | null
editorContent: string // Current editing content
frontmatter: Record<string, unknown> // Current frontmatter being edited
isDirty: boolean // Tracks unsaved changes
// Actions: openFile, saveFile, setEditorContent, updateFrontmatterField
```

**2. Project Store (`useProjectStore`)** - Project-level state:

```typescript
// src/store/projectStore.ts
projectPath: string | null
currentProjectId: string | null
selectedCollection: string | null
globalSettings: GlobalSettings | null
// Actions: setProject, setSelectedCollection, loadPersistedProject
```

**3. UI Store (`useUIStore`)** - UI layout state:

```typescript
// src/store/uiStore.ts
sidebarVisible: boolean
frontmatterPanelVisible: boolean
// Actions: toggleSidebar, toggleFrontmatterPanel
```

**Why This Decomposition?**

- **Performance**: Only relevant components re-render when specific state changes
- **Clarity**: Each store has a single, focused responsibility
- **Maintainability**: Easier to reason about and modify individual concerns
- **Testability**: Each store can be tested independently

#### Local State (React Components)

Keep state local when it:

- Only affects UI presentation
- Is derived from props or global state
- Doesn't need persistence
- Is tightly coupled to component lifecycle

Examples:

```typescript
// UI state in Layout.tsx
const [windowWidth, setWindowWidth] = useState(window.innerWidth)
window.isEditorFocused = false // Global flag for menu coordination
```

#### Why This Split?

- **Performance**: Local state changes don't trigger global re-renders
- **Clarity**: Clear ownership of different concerns
- **Testability**: Business logic can be tested independently of UI
- **Maintainability**: Changes to UI don't affect business logic

### 3. Module Organization

#### Feature Modules (`src/lib/editor/`)

Each feature is a self-contained module with:

- `index.ts` - Public API exports
- `types.ts` - TypeScript interfaces
- Implementation files with descriptive names
- Tests alongside implementation

Example structure:

```
commands/
├── index.ts           # Public exports
├── types.ts           # Interfaces
├── CommandRegistry.ts # Core implementation
├── editorCommands.ts  # Command definitions
└── menuIntegration.ts # Menu-specific logic
```

#### When to Create a Module

Extract code into `lib/` when:

1. It's a distinct feature with 3+ functions
2. It's used by multiple components
3. It has complex logic that benefits from isolation
4. It could be tested independently
5. It might be extended in the future

### 4. Hook Patterns

#### Custom Hooks (`src/hooks/`)

Create custom hooks for:

- Encapsulating stateful logic
- Sharing behavior between components
- Managing side effects
- Integrating with external systems

Example patterns:

```typescript
// Setup hook - initialization and configuration
export const useEditorSetup = (
  onSave: () => void,
  onFocus: () => void,
  onBlur: () => void
) => {
  // Returns configured extensions and setup functions
}

// Handler hook - event management
export const useEditorHandlers = () => {
  // Returns memoized event handlers
}

// Integration hook - external system integration
export const useTauriListeners = (editorView: EditorView | null) => {
  // Sets up and tears down external event listeners
}
```

#### Hook Best Practices

1. Prefix with `use` for clarity
2. Return stable references (use `useCallback`, `useMemo`)
3. Handle cleanup in effect returns
4. Keep focused on a single concern
5. Document dependencies clearly

## Architectural Patterns

### 1. Command Pattern

The editor uses a command registry pattern for operations:

```typescript
// Global registry instance
export const globalCommandRegistry = new CommandRegistry()

// Type-safe command execution
globalCommandRegistry.execute('toggleBold')
globalCommandRegistry.execute('formatHeading', 1)
```

Benefits:

- Decouples command definition from UI triggers
- Enables keyboard shortcuts, menus, and buttons to share logic
- Provides central place for command state management
- Facilitates testing and extensibility

### 2. Plugin Architecture (CodeMirror)

The editor uses **vanilla CodeMirror 6** (not react-codemirror) for maximum control and performance. Editor functionality is composed through extensions:

```typescript
const extensions = [
  markdown({ extensions: [markdownStyleExtension] }),
  syntaxHighlighting(comprehensiveHighlightStyle),
  urlPlugin(),
  dropTargetPlugin(handleDrop),
  keymap.of(customKeymap),
  EditorView.theme(themeConfig),
  // ... more extensions
]

// Direct CodeMirror initialization
const view = new EditorView({
  state: EditorState.create({
    doc: content,
    extensions,
  }),
  parent: containerElement,
})
```

This allows:

- Feature isolation through extensions
- Easy enable/disable of features
- Performance optimization
- Third-party plugin integration
- Direct control over editor lifecycle
- Custom syntax highlighting and theming

### 3. TanStack Query Patterns

#### Query Keys Factory

All query keys are centralized for consistency:

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

#### Query and Mutation Hooks

Create dedicated hooks for each data operation:

```typescript
// hooks/queries/useCollectionsQuery.ts
export const useCollectionsQuery = (projectPath: string | null) => {
  return useQuery({
    queryKey: queryKeys.collections(projectPath || ''),
    queryFn: () => fetchCollections(projectPath!),
    enabled: !!projectPath,
  })
}

// hooks/mutations/useSaveFileMutation.ts
export const useSaveFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveFile,
    onSuccess: (_, variables) => {
      // Invalidate queries to update UI
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

#### Bridge Pattern for Store/Query Integration

When Zustand store actions need query data:

```typescript
// In store (can't use hooks)
createNewFile: async () => {
  window.dispatchEvent(new CustomEvent('create-new-file'))
}

// In component with hook access
const handleCreateNewFile = useCallback(() => {
  const collections = queryClient.getQueryData(
    queryKeys.collections(projectPath)
  )
  // Use collections to create file
}, [projectPath])

useEffect(() => {
  window.addEventListener('create-new-file', handleCreateNewFile)
  return () =>
    window.removeEventListener('create-new-file', handleCreateNewFile)
}, [handleCreateNewFile])
```

### 4. Event-Driven Communication

The app uses multiple event systems:

1. **Tauri Events**: For native menu/OS integration
2. **Custom DOM Events**: For component communication
3. **CodeMirror Transactions**: For editor state changes
4. **Zustand Subscriptions**: For store changes

Example:

```typescript
// Custom event for focus tracking
window.dispatchEvent(new CustomEvent('editor-focus-changed'))

// Tauri event for menu actions
listen('menu-format-bold', () => {
  globalCommandRegistry.execute('toggleBold')
})
```

### 5. Schema Parsing Architecture

**Two-tier fallback system**: Primary JSON schema parser (`parseJsonSchema.ts`) with Zod regex parser fallback (`parseSchemaJson` in `schema.ts`).

**Primary: JSON Schema** (`.astro/collections/*.schema.json`)
- Reads Astro-generated schemas (requires `astro sync`)
- Flattens nested objects with dot notation (`seo.title`, `seo.description`)
- Extracts constraints, descriptions, defaults from JSON Schema metadata
- More reliable than regex parsing

**Fallback: Zod Schema** (`src/content/config.ts`)
- Regex-based parsing of Zod definitions
- Limited: can't parse imports, transforms, or complex nested schemas
- Used when JSON schemas unavailable

**Field Type System**: `SchemaField` interface with `FieldType` enum for standardized type handling. Components accept both `ZodField | SchemaField` for backward compatibility. Use type guard: `'required' in field` to distinguish.

## Keyboard Shortcuts

The app uses `react-hotkeys-hook` for standardized, cross-platform keyboard shortcuts. This replaces manual event handling and provides consistent behavior across operating systems.

### Implementation Pattern

```typescript
import { useHotkeys } from 'react-hotkeys-hook'

// Cross-platform shortcut (Cmd on macOS, Ctrl on Windows/Linux)
useHotkeys(
  'mod+s',
  () => {
    // Save file action
  },
  { preventDefault: true }
)
```

### Key Benefits

- **Cross-platform compatibility**: `mod` key automatically maps to Cmd (macOS) or Ctrl (Windows/Linux)
- **Declarative API**: Define shortcuts where they're used, not in global event handlers
- **Performance**: Built-in event management and cleanup
- **Type safety**: Better TypeScript integration than manual event handling

### Integration with Command System

Keyboard shortcuts work seamlessly with the command registry:

```typescript
useHotkeys(
  'mod+b',
  () => {
    globalCommandRegistry.execute('toggleBold')
  },
  { preventDefault: true }
)
```

This allows the same actions to be triggered from:

- Keyboard shortcuts
- Menu items
- Command palette
- Programmatic calls

## Code Extraction Guidelines

### When to Extract to `lib/`

1. **Complexity Threshold**: 50+ lines of related logic
2. **Reusability**: Used by 2+ components
3. **Testability**: Needs unit tests
4. **Domain Logic**: Business rules or algorithms
5. **External Integration**: APIs, file system, etc.

### When to Extract to `hooks/`

1. **Stateful Logic**: Uses React hooks internally
2. **Component Logic**: Tightly coupled to React lifecycle
3. **Shared Behavior**: Same logic needed in multiple components
4. **Side Effects**: Manages subscriptions, timers, etc.

### Extraction Process

1. **Identify the concern**: What single responsibility does this code have?
2. **Define the interface**: What's the minimal public API?
3. **Extract with tests**: Write tests for the extracted module
4. **Update imports**: Use index.ts for clean imports
5. **Document the module**: Add JSDoc comments for public APIs

## Performance Patterns

**CRITICAL**: Following these patterns is essential to prevent render cascades and maintain optimal performance.

### 1. The `getState()` Pattern

**Core Principle**: Subscribe only to data that should trigger component re-renders. For callbacks that need current state, use `getState()` to access values without subscribing.

```typescript
// ❌ BAD: Causes render cascade
const { currentFile, isDirty, saveFile } = useEditorStore()

const handleSave = useCallback(() => {
  if (currentFile && isDirty) {
    void saveFile()
  }
}, [currentFile, isDirty, saveFile]) // ← Re-creates on every keystroke!

// ✅ GOOD: No cascade
const { setEditorContent } = useEditorStore() // Only subscribe to what triggers re-renders

const handleSave = useCallback(() => {
  const { currentFile, isDirty, saveFile } = useEditorStore.getState()
  if (currentFile && isDirty) {
    void saveFile()
  }
}, []) // ← Stable dependency array
```

**When to Use `getState()`**:
- In useCallback dependencies when you need current state but don't want re-renders
- In event handlers for accessing latest state without subscriptions
- In useEffect with empty dependencies when you need current state on mount only
- In async operations when state might change during execution

### 2. Store Subscription Optimization

#### Specific Selectors vs Object Destructuring

```typescript
// ❌ BAD: Object recreation triggers re-renders
const { currentFile } = useEditorStore() 

// ✅ GOOD: Primitive selectors only change when needed
const hasCurrentFile = useEditorStore(state => !!state.currentFile)
const currentFileName = useEditorStore(state => state.currentFile?.name)
const fileCount = useEditorStore(state => state.files.length)
```

#### Function Dependencies in useEffect

```typescript
// ❌ BAD: Function dependencies cause re-render loops
const { loadProject } = useProjectStore()
useEffect(() => {
  void loadProject()
}, [loadProject])

// ✅ GOOD: Direct getState() calls
useEffect(() => {
  void useProjectStore.getState().loadProject()
}, [])
```

### 3. CSS Visibility vs Conditional Rendering

For stateful UI components (like `react-resizable-panels`), use CSS visibility instead of conditional rendering:

```typescript
// ❌ BAD: Conditional rendering breaks stateful components
{frontmatterVisible ? (
  <ResizablePanelGroup>
    <ResizablePanel>Content</ResizablePanel>
  </ResizablePanelGroup>
) : (
  <div>Content</div>
)}

// ✅ GOOD: CSS visibility preserves component tree
<ResizablePanelGroup>
  <ResizablePanel 
    className={cn(
      'base-styles',
      frontmatterVisible ? '' : 'hidden'
    )}
  >
    Content
  </ResizablePanel>
</ResizablePanelGroup>
```

### 4. Strategic React.memo Placement

Use React.memo to break render cascades at component boundaries:

```typescript
// ✅ GOOD: Breaks cascade propagation
const EditorAreaWithFrontmatter = React.memo(({ frontmatterPanelVisible }) => {
  // Component only re-renders when frontmatterPanelVisible changes
  // Not affected by parent re-renders from unrelated state
})

// ❌ NOTE: React.memo doesn't help with internal store subscriptions
const Editor = React.memo(() => {
  const content = useStore(state => state.content) // Still triggers re-renders
  // React.memo can't prevent re-renders from internal subscriptions
})
```

### 5. Traditional Memoization

Use memoization strategically for expensive computations:

```typescript
// Memoize expensive computations
const sortedFiles = useMemo(
  () => files.sort((a, b) => compareDates(a, b)),
  [files]
)

// Stable callbacks for child components (using getState pattern)
const handleChange = useCallback(
  (value: string) => {
    useEditorStore.getState().setEditorContent(value)
  },
  [] // Stable dependency array
)
```

### 6. Lazy Loading

- Defer heavy operations until needed
- Use dynamic imports for large dependencies
- Virtualize long lists

### 7. Debouncing

Critical for editor performance:

```typescript
// Auto-save debouncing
scheduleAutoSave: () => {
  clearTimeout(timeoutId)
  timeoutId = setTimeout(() => saveFile(), 2000)
}
```

### 8. Performance Anti-Patterns to Avoid

1. **Subscribing to frequently-changing data** in components that don't need to re-render
2. **Using objects as dependencies** in useCallback/useEffect when you only need specific properties
3. **Conditional rendering** of complex stateful components
4. **Function dependencies** in useEffect when you can use direct getState() calls
5. **Object destructuring** from stores for frequently-changing data

### 9. Performance Monitoring

Add temporary render tracking during development:

```typescript
// Temporary debugging only - remove before production
const renderCountRef = useRef(0)
renderCountRef.current++
console.log(`[ComponentName] RENDER #${renderCountRef.current}`)
```

**Always remove render tracking after debugging.**

### 10. Performance Testing Checklist

- Monitor component render counts during typical interactions
- Test with sidebars in different states
- Verify auto-save works under all conditions
- Use React DevTools Profiler to identify unnecessary re-renders
- Ensure editor renders only once per actual content change

## Testing Strategy

### Unit Tests (Modules)

Test extracted modules thoroughly:

```typescript
// lib/editor/markdown/formatting.test.ts
describe('toggleMarkdown', () => {
  it('should wrap selection with markers', () => {
    // Test the pure logic
  })
})
```

### Integration Tests (Hooks)

Test hooks with React Testing Library:

```typescript
// hooks/editor/useEditorHandlers.test.tsx
describe('useEditorHandlers', () => {
  it('should save on blur when dirty', () => {
    // Test the hook behavior
  })
})
```

### Component Tests

Focus on user interactions:

```typescript
// components/Layout/EditorView.test.tsx
describe('EditorView', () => {
  it('should highlight URLs on alt hover', async () => {
    // Test the integrated behavior
  })
})
```

### Frontmatter Field Component Tests

For complex field components with business logic, use focused unit tests:

```typescript
// components/frontmatter/fields/__tests__/ArrayField.test.tsx
describe('ArrayField Component', () => {
  describe('Array Validation Logic', () => {
    it('should handle proper string arrays', () => {
      // Test complex array validation logic
    })

    it('should handle arrays with non-string values', () => {
      // Test edge cases that are hard to reproduce in integration tests
    })
  })
})
```

**When to Unit Test Field Components:**

- Complex validation logic (e.g., ArrayField string-only validation)
- Schema default handling (e.g., BooleanField's getBooleanValue)
- Orchestration logic (e.g., FrontmatterField's type selection)

**Testing Strategy:**

- **Integration Tests**: Cover happy path and user interactions (FrontmatterPanel.test.tsx)
- **Unit Tests**: Cover complex logic and edge cases in individual components
- **Focus on Business Logic**: Test logic, not UI rendering

## Component Extraction Patterns

### Frontmatter Field Components

When extracting form field components, follow the **Direct Store Pattern** with **ShadCN Field components**:

```typescript
// ✅ CORRECT: Direct store access with Field components
const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={frontmatter[name]}
    >
      <Input
        value={valueToString(frontmatter[name])}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </FieldWrapper>
  )
}
```

**Field Component Structure:**

The app uses ShadCN's Field components for consistent form layouts:

```typescript
import {
  Field,           // Container with vertical/horizontal orientation
  FieldLabel,      // Label with required indicator support
  FieldContent,    // Wrapper for input + description
  FieldDescription, // Helper text below input
  FieldGroup,      // Group multiple fields
} from '@/components/ui/field'
```

**FieldWrapper Pattern:**

For frontmatter fields, use `FieldWrapper` which provides:
- Automatic label/description/constraints rendering
- Required field indicators
- Default value display when field is empty
- Horizontal layout support for toggles/switches
- Schema metadata integration

```typescript
// FieldWrapper handles Field component composition internally
<FieldWrapper
  label="Title"
  required={true}
  description="The post title"
  defaultValue="Untitled"
  constraints={{ minLength: 3, maxLength: 100 }}
  currentValue={frontmatter.title}
>
  <Input {...inputProps} />
</FieldWrapper>
```

**Component Structure:**

```
src/components/frontmatter/fields/
├── __tests__/           # Unit tests for complex logic
│   ├── ArrayField.test.tsx
│   ├── BooleanField.test.tsx
│   ├── FrontmatterField.test.tsx
│   ├── FieldWrapper.test.tsx
│   └── utils.test.tsx
├── FieldWrapper.tsx     # Wrapper using Field components
├── StringField.tsx      # Simple text input
├── TextareaField.tsx    # Multi-line text input
├── NumberField.tsx      # Numeric input with validation
├── BooleanField.tsx     # Switch with schema defaults (horizontal layout)
├── DateField.tsx        # Date picker integration
├── EnumField.tsx        # Select dropdown
├── ArrayField.tsx       # Tag input with validation
├── FrontmatterField.tsx # Orchestrator component
└── index.ts             # Barrel exports
```

**Key Patterns:**

1. **Single Responsibility**: Each field component handles one data type
2. **Direct Store Access**: No callback props, direct store updates
3. **Type Safety**: Proper TypeScript interfaces and validation
4. **Schema Integration**: Leverage Zod/JSON schema information for defaults and constraints
5. **Field Components**: Use FieldWrapper for consistent layouts
6. **Layout Support**: Use `layout="horizontal"` for toggles/switches
7. **Utility Separation**: Shared logic in utils.ts

### Settings and Preferences Forms

For settings/preferences panes, use ShadCN Field components directly without FieldWrapper:

```typescript
// ✅ Settings form with Field components
<FieldGroup>
  <Field>
    <FieldLabel>Theme</FieldLabel>
    <FieldContent>
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectContent>
      </Select>
      <FieldDescription>
        Choose your preferred color theme
      </FieldDescription>
    </FieldContent>
  </Field>
</FieldGroup>
```

**Settings Pattern Guidelines:**

1. **Use FieldGroup** to group related settings sections
2. **Label First**: FieldLabel before FieldContent
3. **Description Last**: FieldDescription inside FieldContent, after the input
4. **Simple Containers**: For complex inputs (e.g., color pickers with reset buttons), use simple div containers with flex layout instead of trying to force InputGroup
5. **Direct Updates**: Settings use hooks like `usePreferences()` which handle updates directly

**Example: Color Picker with Reset**

```typescript
<Field>
  <FieldLabel>Heading Color</FieldLabel>
  <FieldContent>
    <div className="flex items-center gap-2 w-fit">
      <input
        type="color"
        value={color}
        onChange={e => handleColorChange(e.target.value)}
        className="w-20 h-9 cursor-pointer rounded-md border border-input bg-transparent"
      />
      <Button variant="outline" size="sm" onClick={handleReset}>
        Reset
      </Button>
    </div>
    <FieldDescription>Choose the heading color</FieldDescription>
  </FieldContent>
</Field>
```

## Future Extensibility

### Plugin System Considerations

The architecture is designed to support future plugins:

1. **Command Registry**: New commands can be registered
2. **CodeMirror Extensions**: New editor features as extensions
3. **Module Structure**: New modules follow established patterns
4. **Event System**: New integrations via event listeners

### Planned Extension Points

1. **Theme System**: Custom editor themes
2. **Language Support**: Beyond markdown
3. **AI Integration**: Via command registry
4. **Export Formats**: Via new modules
5. **Cloud Sync**: Via store middleware

## Color System and Theming

The app implements a comprehensive color system supporting both light and dark modes. See [`color-system.md`](./color-system.md) for detailed documentation including:

- CSS variable-based theme tokens
- Tailwind dark mode class usage
- Component-specific color patterns
- Traffic light button styling
- Status color system for drafts and validation

**Key Pattern**: Use CSS variables (`text-foreground`) for semantic colors, and Tailwind dark classes (`text-gray-900 dark:text-white`) for explicit light/dark styling where CSS variables don't provide sufficient control.

## Common Pitfalls to Avoid

1. **Don't mix concerns**: Keep business logic out of components
2. **Don't over-optimize**: Measure before memoizing everything
3. **Don't bypass the store**: All business state changes go through Zustand
4. **Don't create circular dependencies**: Use index.ts exports
5. **Don't ignore TypeScript**: Leverage types for safety

## Decision Log

### Why Not React Hook Form?

- Causes infinite loops with Zustand
- Direct store pattern is simpler and more performant
- Better real-time sync with auto-save

### Why CodeMirror over Monaco?

- Better markdown support
- Lighter weight
- More extensible for our use case
- Better mobile support (future)

### Why Tauri over Electron?

- Smaller bundle size
- Better performance
- Native feel on macOS
- Rust safety for file operations

## Module Dependency Graph

```
App
├── QueryClientProvider (TanStack Query)
│   └── Layout (orchestrator)
│       ├── Sidebar
│       │   ├── useCollectionsQuery
│       │   ├── useCollectionFilesQuery
│       │   └── useProjectStore (selectedCollection)
│       ├── MainEditor
│       │   ├── Editor
│       │   │   ├── useEditorStore (currentFile, content, frontmatter)
│       │   │   ├── hooks/editor/* (setup, handlers)
│       │   │   └── lib/editor/* (commands, syntax, etc.)
│       │   └── StatusBar
│       └── FrontmatterPanel
│           ├── useCollectionsQuery
│           └── useEditorStore (frontmatter, updateFrontmatterField)
├── Decomposed Zustand Stores:
│   ├── editorStore (file editing state)
│   │   ├── currentFile, editorContent, frontmatter
│   │   ├── isDirty, autoSaveTimeoutId
│   │   └── openFile, saveFile, updateFrontmatterField
│   ├── projectStore (project-level state)
│   │   ├── projectPath, currentProjectId, selectedCollection
│   │   ├── globalSettings, currentProjectSettings
│   │   └── setProject, loadPersistedProject, startFileWatcher
│   └── uiStore (UI layout state)
│       ├── sidebarVisible, frontmatterPanelVisible
│       └── toggleSidebar, toggleFrontmatterPanel
├── hooks/queries/* (server state via TanStack Query)
├── hooks/mutations/* (write operations via TanStack Query)
└── Tauri Commands (Rust backend)
```

This architecture ensures:

- Clear data flow with focused responsibilities
- Testable modules with single concerns
- Extensible design with clean separation
- Performance optimization through targeted re-renders
- Maintainable codebase with explicit state ownership
