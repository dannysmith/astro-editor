# Claude Instructions for Astro Editor

## Current Status

@CLAUDE.local.md

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
- Review `docs/developer/architecture-guide.md` for essential patterns
- Consult specialized guides when working on specific features (see [Documentation Structure](#documentation-structure))
- Check git status and project structure

### Development Practices

**CRITICAL:** Follow these strictly:

1. **Read Before Editing**: Always read files first to understand context
2. **Follow Established Patterns**: Use patterns from this file and `docs/developer`
3. **Senior Architect Mindset**: Consider performance, maintainability, testability
4. **Batch Operations**: Use multiple tool calls in single responses
5. **Match Code Style**: Follow existing formatting and patterns
6. **Test Coverage**: Write comprehensive tests for business logic
7. **Quality Gates**: Run `pnpm run check:all` after significant changes
8. **No Dev Server**: Ask user to run and report back
9. **No Unsolicited Commits**: Only when explicitly requested
10. **Documentation**: Update `docs/developer/` guides for new patterns
11. **Removing files**: Always use `rm -f`

### Documentation Structure

**Core Guides** (read for daily development):
- `docs/developer/architecture-guide.md` - Essential patterns (START HERE)
- `docs/developer/performance-guide.md` - Performance optimization (getState, memoization)
- `docs/developer/testing-guide.md` - Testing strategies

**Feature Implementation** (consult when implementing specific features):
- `docs/developer/form-patterns.md` - Frontmatter fields and settings forms
- `docs/developer/schema-system.md` - Schema parsing and merging (Rust)
- `docs/developer/keyboard-shortcuts.md` - Implementing shortcuts
- `docs/developer/decisions.md` - Architectural choices and trade-offs

**System Documentation** (reference for system features):
- `docs/developer/preferences-system.md` - Three-tier settings hierarchy
- `docs/developer/color-system.md` - Color tokens and dark mode
- `docs/developer/toast-system.md` - Notification system
- `docs/developer/editor-styles.md` - CodeMirror syntax highlighting
- `docs/developer/recovery-system.md` - Crash recovery

**Component/Reference** (specific implementations):
- `docs/developer/unified-title-bar.md` - Main toolbar component
- `docs/developer/image-preview-implementation.md` - Image field preview
- `docs/developer/astro-generated-contentcollection-schemas.md` - Astro JSON Schema reference

**Operations** (for releases and setup):
- `docs/developer/release-process.md` - Release workflow
- `docs/developer/apple-signing-setup.md` - Code signing

See `docs/README.md` for the complete categorized list.

### Documentation & Versions

- **Context7 First**: Always use Context7 for framework docs before WebSearch
- **Version Requirements**: Tauri v2.x, shadcn/ui v4.x, Tailwind v4.x, React 19.x, Zustand v5.x, CodeMirror v6.x, Vitest v3.x
- **Progress Tracking**: Update current task in `docs/tasks-todo` after major work

## Specialized Agents

The project has six specialized agents to help with complex implementation challenges:

### Project-Integrated Agents

**1. macos-ui-engineer** - Use when:

- Implementing native-feeling macOS UI patterns
- Working on typography, spacing, or visual hierarchy
- Creating or refining components that need to feel authentically Mac-like
- Applying Apple HIG principles to interface design

**2. react-performance-architect** - Use when:

- Reviewing React components for performance issues
- Implementing complex state management patterns
- Addressing render cascades or unnecessary re-renders
- Optimizing React hook usage and component architecture

**3. rust-test-engineer** - Use when:

- Writing comprehensive tests for Tauri backend code
- Testing file operations, schema parsing, or Rust commands
- Ensuring proper test coverage for business logic
- Creating integration tests for Tauri-frontend communication

**4. typescript-test-engineer** - Use when:

- Writing tests for React components, hooks, or TypeScript modules
- Testing Zustand stores, TanStack Query hooks, or complex business logic
- Ensuring comprehensive test coverage for frontend code
- Creating test utilities and fixtures

### External Expert Consultants

**5. tauri-v2-expert** - Call in when:

- Facing complex Tauri v2 architectural decisions
- Debugging difficult IPC or native integration issues
- Implementing advanced Tauri features (plugins, multi-window, system integration)
- Optimizing performance or solving platform-specific problems

**6. codemirror-6-specialist** - Call in when:

- Implementing complex CodeMirror extensions or customizations
- Debugging editor state management or React integration issues
- Building advanced editor features (collaborative editing, custom parsers, etc.)
- Optimizing editor performance or solving rendering problems

### Orchestration Guidelines

- **Use project-integrated agents** for implementation work within established patterns
- **Call external consultants** when facing novel problems or needing deep expertise
- **Combine agents** when problems span multiple domains (e.g., performance + UI)
- **Agents can collaborate** - one may recommend consulting another for specialized aspects

## Custom Commands

### /check - Quality Control

Use `/check` to verify work quality before completing tasks:
- Checks adherence to architecture-guide.md patterns
- Removes unnecessary comments and console.logs
- Runs `pnpm run check:all` and fixes errors
- Cleans up leftover code from failed approaches

**When to use**: Before completing significant features or refactoring work.

### Task Management

Use the task completion script to mark tasks as done:

```bash
# Complete a task (move from tasks-todo to tasks-done with today's date)
pnpm task:complete <task-name>

# Examples:
pnpm task:complete frontend-performance
pnpm task:complete 2
```

The script automatically:
- Finds matching tasks by partial name or number
- Strips the `task-[number]-` prefix
- Adds completion date: `task-YYYY-MM-DD-`
- Moves from `tasks-todo/` to `tasks-done/`

**See `docs/TASKS.md` for full task management workflow.**

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
pnpm run dev              # Start dev server
pnpm run tauri:build      # Build app
pnpm run check:all        # All checks (TS + Rust + tests) - RUN BEFORE COMMITS
pnpm run fix:all          # Auto-fix all issues
pnpm run test             # Watch mode
pnpm run test:run         # Run once
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

### Reusable Utilities

Before creating new utilities, check these existing modules:

- `src/lib/dates.ts` - Date formatting (`formatIsoDate()`, `todayIsoDate()`)
- `src/lib/ide.ts` - IDE integration (`openInIde()`)
- `src/lib/projects/actions.ts` - Project operations (`openProjectViaDialog()`)
- `src/lib/files/` - File processing and asset management
- `src/components/frontmatter/fields/constants.ts` - Field constants (`NONE_SENTINEL`)

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
