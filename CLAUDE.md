# Claude Instructions for Astro Editor

## Current Status

Current Task: `/docs/tasks-todo/task-7-copyedit-mode.md`

## Project Overview

**Goal:** Native macOS markdown editor for Astro content collections. Distraction-free writing environment with seamless frontmatter editing, inspired by iA Writer.

**Purpose:** Replace code editors for content writing. Focused environment understanding Astro's content structure.

**Key Features:**

- Auto-discovers Astro content collections from `src/content/config.ts`
- Dynamic frontmatter forms from Zod schemas
- File management with context menus
- Real-time auto-save every 2 seconds
- CodeMirror 6 with custom syntax highlighting
- Resizable panels, draft detection, file sorting
- Advanced editor features: URL clicking, drag & drop, markdown commands
- Comprehensive keyboard shortcuts and menu integration
- Toast notifications throughout the app

## Core Rules

### New Sessions

- Read @docs/TASKS.md for task management
- Review `docs/developer/architecture-guide.md` for patterns
- Check git status and project structure

### Development Practices

**CRITICAL:** Follow these strictly:

1. **Read Before Editing**: Always read files first to understand context
2. **Follow Established Patterns**: Use patterns from this file and `docs/developer`
3. **Senior Architect Mindset**: Consider performance, maintainability, testability
4. **Batch Operations**: Use multiple tool calls in single responses
5. **Match Code Style**: Follow existing formatting and patterns
6. **Test Coverage**: Write comprehensive tests for business logic
7. **Quality Gates**: Run `npm run check:all` after significant changes
8. **No Dev Server**: Ask user to run and report back
9. **No Unsolicited Commits**: Only when explicitly requested
10. **Documentation**: Update `docs/developer/architecture-guide.md` for new patterns
11. **Removing files**: Always use `rm -f`

### Documentation & Versions

- **Context7 First**: Always use Context7 for framework docs before WebSearch
- **Version Requirements**: Tauri v2.x, shadcn/ui v4.x, Tailwind v4.x, React 19.x, Zustand v5.x, CodeMirror v6.x, Vitest v3.x
- **Progress Tracking**: Update current task in `docs/tasks-todo` after major work

## Technology Stack

- **Framework:** Tauri v2 (Rust + React)
- **Frontend:** React 19 + TypeScript (strict)
- **State:** Hybrid approach:
  - **Server State:** TanStack Query v5 for data fetching/caching
  - **Client State:** Zustand for UI state and editing state
- **Styling:** Tailwind v4 + shadcn/ui
- **Editor:** CodeMirror 6 (vanilla) with custom extensions
- **Testing:** Vitest + React Testing Library, Cargo
- **Quality:** ESLint, Prettier, Clippy

**CRITICAL:** Use Tauri v2 docs only. Always use modern Rust formatting: `format!("{variable}")`

## Architecture Overview

**See `docs/developer/architecture-guide.md` for comprehensive architectural patterns and detailed implementation guidance.**

### State Management (Essential Summary)

- **Server State**: TanStack Query for filesystem data (`useCollectionsQuery`, `useCollectionFilesQuery`, `useFileContentQuery`)
- **Client State**: Decomposed Zustand stores - `editorStore` (file editing), `projectStore` (project-level), `uiStore` (layout)
- **Local State**: UI presentation, derived state, component lifecycle only

## Key Patterns

### Direct Store Pattern (CRITICAL)

**Problem:** React Hook Form + Zustand causes infinite loops
**Solution:** Components access store directly

```tsx
// ✅ CORRECT: Direct store pattern
const StringField = ({ name, label, required }) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  return (
    <Input
      value={frontmatter[name] || ''}
      onChange={e => updateFrontmatterField(name, e.target.value)}
    />
  )
}

// ❌ WRONG: Callback dependencies cause infinite loops
const BadField = ({ name, onChange }) => {
  /* Don't do this */
}
```

### Command Pattern

```typescript
// Global registry for all editor operations
globalCommandRegistry.execute('toggleBold')
globalCommandRegistry.execute('formatHeading', 1)
```

Benefits: Decouples UI from logic, enables shortcuts/menus/palette to share commands

### Event-Driven Communication

1. **Tauri Events**: Native menu/OS integration
2. **Custom DOM Events**: Component communication
3. **CodeMirror Transactions**: Editor state
4. **Zustand Subscriptions**: Store changes
5. **Toast Events**: Rust-to-frontend notifications

#### Bridge Pattern for Store/Query Data

```typescript
// In store (no React hooks)
createNewFile: async () => {
  window.dispatchEvent(new CustomEvent('create-new-file'))
}

// In Layout (has hooks)
useEffect(() => {
  const handleCreateNewFile = () => {
    const collections = queryClient.getQueryData(
      queryKeys.collections(projectPath)
    )
    // Use collections data
  }
  window.addEventListener('create-new-file', handleCreateNewFile)
  return () =>
    window.removeEventListener('create-new-file', handleCreateNewFile)
}, [])
```

### TanStack Query Patterns

#### Query Keys Factory

```typescript
export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  // ... etc
}
```

#### Automatic Cache Invalidation

```typescript
// In mutation's onSuccess
queryClient.invalidateQueries({
  queryKey: queryKeys.collectionFiles(projectPath, collectionName),
})
```

## Keyboard Shortcuts

Uses `react-hotkeys-hook` for cross-platform shortcuts:

```typescript
useHotkeys(
  'mod+s',
  () => {
    /* save */
  },
  { preventDefault: true }
)
```

**Available:** `mod+s` (save), `mod+1` (sidebar), `mod+2` (frontmatter), `mod+n` (new), `mod+w` (close), `mod+comma` (preferences)

## Code Extraction Patterns

**See `docs/developer/architecture-guide.md` for detailed extraction guidelines.**

**Quick Reference**:
- **Extract to `lib/`**: 50+ lines, 2+ components, business logic, testable modules
- **Extract to `hooks/`**: React hooks, component lifecycle, side effects
- **Process**: Single responsibility → minimal API → tests → index.ts exports

## Development Commands & Organization

```bash
npm run dev              # Start dev server
npm run tauri:build      # Build app
npm run check:all        # All checks (TS + Rust + tests) - RUN BEFORE COMMITS
npm run fix:all          # Auto-fix all issues
npm run test             # Watch mode
npm run test:run         # Run once
```

**Component Organization**: `kebab-case` directories, `PascalCase` components, `index.ts` barrel exports, domain-based grouping

## Editor System Architecture

### Custom Syntax Highlighting

Uses comprehensive custom highlighting replacing CodeMirror defaults:

1. **Custom Markdown Tags** (`markdownTags.ts`)
2. **Standard Language Tags** from `@lezer/highlight`
3. **Single highlight style** with 50+ rules

See `docs/developer/editor-styles.md` for CSS theming details.

## Command Palette Architecture

To add new command groups:

1. **Update Types** (`src/lib/commands/types.ts`):

```typescript
export type CommandGroup = 'file' | 'navigation' | 'your-new-group'
```

2. **Add Context Function** (`src/lib/commands/command-context.ts`)
3. **Define Commands** (`src/lib/commands/app-commands.ts`)
4. **Update Group Order** (`src/hooks/useCommandPalette.ts`)
5. **Add Event Listener** if needed (in Layout.tsx)

## Testing & Performance

**Testing Strategy**: Unit tests for `lib/` modules, integration tests for hooks/workflows, component tests for user interactions. **See `docs/developer/architecture-guide.md` for detailed testing patterns.**

**Performance**: Use memoization, debouncing (2s auto-save), and the `getState()` pattern for callback dependencies. **See architecture guide for comprehensive performance patterns including render cascade prevention.**

## Best Practices

### Component Development

- **NEVER** use React Hook Form (infinite loops)
- **ALWAYS** use Direct Store Pattern
- **EXTRACT** helper components for repeated JSX (3+ times)
- **TYPE** store destructuring explicitly

### Module Development

- **EXTRACT** complex logic into `lib/`
- **CREATE** hooks for stateful logic
- **DEFINE** clear interfaces
- **WRITE** comprehensive tests
- **DOCUMENT** public APIs

## Troubleshooting

- **Infinite loops:** Check Direct Store Pattern
- **Auto-save:** Verify 2s interval and `scheduleAutoSave()`
- **Schema parsing:** Check `src/content/config.ts` syntax
- **Version conflicts:** Use v2/v4 docs only
- **Toast/Theme issues:** See `docs/developer/toast-system.md`

## Key Files Reference

### Essential Files

- `src/store/*.ts` - State management
- `src/lib/query-keys.ts` - TanStack Query keys
- `src/components/layout/Layout.tsx` - Main orchestrator
- `src/lib/editor/` - Editor modules
- `src/lib/schema.ts` - Zod schema parsing

### Documentation

- `docs/developer/architecture-guide.md` - Comprehensive patterns
- `docs/developer/toast-system.md` - Notifications
- `docs/developer/editor-styles.md` - CSS theming
- `docs/developer/preferences-system.md` - Settings
- `docs/developer/recovery-system.md` - Error handling

## WebKit/Tauri Considerations

- `field-sizing: content` not supported → use `AutoExpandingTextarea`
- WebKit differs from Chrome DevTools
- JavaScript-based textarea auto-expansion
- Tauri v2 has different API than v1

---

_This document reflects current architecture. For detailed patterns and decision logs, see `docs/developer/architecture-guide.md`_
