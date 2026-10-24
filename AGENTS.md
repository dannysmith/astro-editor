# Claude / AI Agent Instructions for Astro Editor

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

**Note:** The `website/` directory is an independent project that is not part of the main app's dependency tree. See `website/AGENTS.md` for its own instructions.

## Core Rules

### New Sessions

- Check `docs/tasks-todo/` for the current task (see [Task Management](#task-management))
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
7. **Quality Gates**: Before finishing significant work, check it against `docs/developer/architecture-guide.md`, remove leftover debug code, unnecessary comments and remnants of failed approaches, then run `bun run check:all` and fix any errors
8. **No Dev Server**: Ask user to run and report back
9. **No Unsolicited Commits**: Only when explicitly requested
10. **Documentation**: Update `docs/developer/` guides for new patterns
11. **Removing files**: Always use `rm -f`

#### Directory Boundaries

- **Hooks belong in `/hooks/`**: If it exports a `use*` function, it goes in `/hooks/`
- **Pure functions in `/lib/`**: Business logic, utilities, classes
- **getState() is allowed**: One-way calls from lib to store using `getState()` are acceptable
- See `docs/developer/architecture-guide.md` for complete rules

### Documentation Structure

**Core Guides** (read for daily development):
- `docs/developer/architecture-guide.md` - Essential patterns and overview (START HERE)
- `docs/developer/state-management.md` - Deep dive into the "Onion" pattern and store decomposition
- `docs/developer/command-system.md` - Command pattern implementation and integration
- `docs/developer/ui-patterns.md` - Common UI patterns and shadcn/ui best practices
- `docs/developer/performance-patterns.md` - Performance optimization (getState, memoization)
- `docs/developer/testing.md` - Testing strategies and patterns

**System Documentation** (reference for system features):
- `docs/developer/cross-platform.md` - Platform detection, conditional compilation, title bar architecture
- `docs/developer/form-patterns.md` - Frontmatter fields and settings forms
- `docs/developer/schema-system.md` - Schema parsing and merging (Rust)
- `docs/developer/keyboard-shortcuts.md` - Implementing shortcuts
- `docs/developer/preferences-system.md` - Three-tier settings hierarchy
- `docs/developer/color-system.md` - Color tokens and dark mode
- `docs/developer/notifications.md` - Toast notification system
- `docs/developer/editor-styles.md` - CodeMirror syntax highlighting
- `docs/developer/recovery-system.md` - Crash recovery
- `docs/developer/logging.md` - Logging system

**Implementation** (optimization and build):
- `docs/developer/optimization.md` - Bundle optimization and performance budgets
- `docs/developer/releases.md` - Release workflow and process

**Feature Examples** (specific implementations):
- `docs/developer/feature-image-preview.md` - Image field preview implementation
- `docs/developer/astro-generated-contentcollection-schemas.md` - Astro JSON Schema reference

**Reference** (decisions and setup):
- `docs/developer/decisions.md` - Architectural decisions and trade-offs
- `docs/developer/apple-signing-setup.md` - Code signing and deployment

See `docs/README.md` for the complete categorized list.

### Documentation & Versions

- **Context7 First**: Always use Context7 for framework docs before WebSearch
- **Version Requirements**: Tauri v2.x, shadcn/ui v4.x, Tailwind v4.x, React 19.x, Zustand v5.x, CodeMirror v6.x, Vitest v5.x
- **Progress Tracking**: Update current task in `docs/tasks-todo` after major work

## Skills

Project skills live in `.claude/skills/`:

- **deps-update** - Interactive dependency update session across the whole repo, tracked in a task doc
- **codebase-hygiene** - Find unused code/dependencies (knip) and duplication (jscpd), and clean up what the user approves

## Task Management

Tasks live in `docs/tasks-todo/` as `task-[number]-[name].md` (lowest number is next; `x` means unprioritised). When one is done, move it to `docs/tasks-done/` renamed `task-YYYY-MM-DD-[number]-[name].md` with the completion date.

## Technology Stack

- **Framework:** Tauri v2 (Rust + React)
- **Frontend:** React 19 + TypeScript (strict) with React Compiler
  - `@babel/core` is a direct devDependency pinned to 7. It's only a peer of `@rolldown/plugin-babel` (which allows 8), but `babel-plugin-react-compiler` is built against Babel 7
- **State:** Hybrid approach:
  - **Server State:** TanStack Query v5 for data fetching/caching
  - **Client State:** Zustand for UI state and editing state
- **Styling:** Tailwind v4 + shadcn/ui
- **Editor:** CodeMirror 6 (vanilla) with custom extensions
  - **IMPORTANT:** All `@lezer/*` packages must use consistent versions across the dependency tree. We use `overrides` in `package.json` to force `@lezer/common` to match CodeMirror's version. Mismatched versions break syntax highlighting and cause runtime errors because Tag/Tree objects from different versions are incompatible. The same goes for `@codemirror/*` (duplicate `@codemirror/view` breaks typecheck). `bun update` can leave older copies nested under other packages; `grep -E '"[^"]+/@(codemirror|lezer)/' bun.lock` must print nothing, and if it doesn't, regenerate the lockfile (`rm -rf node_modules bun.lock && bun install`).
- **Testing:** Vitest + React Testing Library, Cargo
- **Quality:** Oxlint (type-aware, with React Compiler rules), Oxfmt, ast-grep, Clippy

**CRITICAL:** Use Tauri v2 docs only. Always use modern Rust formatting: `format!("{variable}")`

### Tauri Commands (tauri-specta)

Commands use **tauri-specta** for end-to-end type safety. TypeScript bindings are auto-generated.

**Adding a new command:**
1. Define in Rust with `#[tauri::command]` and `#[specta::specta]`
2. Add to `src-tauri/src/bindings.rs` `collect_commands![]`
3. Regenerate bindings with `cd src-tauri && cargo test export_bindings -- --ignored` (no app launch needed; `bun run tauri dev` also regenerates them in debug mode)
4. Commit the updated `src/lib/bindings.ts`
5. Add JSDoc to `src/types/domain.ts` if exposing a new type

**Usage:** Import from `@/lib/bindings`, handle `Result` types:
```typescript
import { commands } from '@/lib/bindings'
const result = await commands.scanProject(path)
if (result.status === 'error') throw new Error(result.error)
```

### React Compiler

**Automatic Optimization**: React Compiler (v1.0) automatically memoizes components and hooks, eliminating the need for manual `useMemo`, `useCallback`, and `React.memo` in most cases. See `docs/developer/performance-patterns.md` for comprehensive guidance.

**Key Points**:
- Compiler handles memoization automatically - don't add manual memoization unless profiling shows a need
- Enforces Rules of React through lint rules (Oxlint's `react/*` React Compiler rules)
- **"use no memo" directive**: Opt-out specific components if needed (document why)
- **Zustand patterns unchanged**: Selector syntax and `getState()` remain critical for performance

## Architecture Overview

**See `docs/developer/architecture-guide.md` for comprehensive architectural patterns and detailed implementation guidance.**

### State Management (Essential Summary)

- **Server State**: TanStack Query for filesystem data (`useCollectionsQuery`, `useCollectionFilesQuery`, `useFileContentQuery`)
- **Client State**: Decomposed Zustand stores - `editorStore` (file editing), `projectStore` (project-level), `uiStore` (layout)
- **Local State**: UI presentation, derived state, component lifecycle only

## Key Patterns

### Direct Store Pattern (CRITICAL)

**Problem:** React Hook Form + Zustand causes infinite loops
**Solution:** Components access store directly using selector syntax

```tsx
// ✅ CORRECT: Direct store pattern with selector syntax
const StringField = ({ name, label, required }) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  return (
    <Input
      value={value || ''}
      onChange={e => updateFrontmatterField(name, e.target.value)}
    />
  )
}

// ❌ WRONG: Callback dependencies cause infinite loops
const BadField = ({ name, onChange }) => {
  /* Don't do this */
}
```

**Note:** Always use selector syntax (`useStore(state => state.value)`) instead of destructuring (`const { value } = useStore()`) to create granular subscriptions. For objects/arrays, use `useShallow` to prevent re-renders from reference changes. See performance-patterns.md for details.

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

#### Hybrid Action Hooks Pattern

**Problem**: Zustand stores can't use React hooks, but user-triggered actions need query data.

**Solution**: User-triggered actions live in hooks with direct query access; state-triggered actions (auto-save) live in stores and call registered callbacks.

```typescript
// 1. Hook with direct query access (user-triggered actions)
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async (showToast = true) => {
    // Direct access to stores via getState() - no subscription
    const { currentFile, editorContent, frontmatter } = useEditorStore.getState()
    const { projectPath } = useProjectStore.getState()

    // Direct access to query data - NO EVENTS!
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    const schema = collections?.find(c => c.name === currentFile.collection)?.complete_schema

    await commands.saveMarkdownContent(/* ... */)
    useEditorStore.getState().markAsSaved()
  }, [queryClient])

  return { saveFile }
}

// 2. Store with state-triggered logic
const useEditorStore = create((set, get) => ({
  autoSaveCallback: null,
  setAutoSaveCallback: callback => set({ autoSaveCallback: callback }),

  // State mutation triggers auto-save
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

// 3. Layout wires them together
export function Layout() {
  const { saveFile } = useEditorActions()

  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
  }, [saveFile])
}
```

**Benefits**: No polling, type-safe, synchronous data access, easy to test

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
bun run dev              # Start dev server
bun run tauri:build      # Build app
bun run check:all        # All checks (TS + Rust + ast-grep + tests) - RUN BEFORE COMMITS
bun run fix:all          # Auto-fix all issues
bun run ast:lint         # Run ast-grep architectural linting
bun run ast:fix          # Auto-fix ast-grep violations (where possible)
bun run test             # Watch mode
bun run test:run         # Run once
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

**Performance**: React Compiler handles most memoization automatically. Focus on:
- **Zustand patterns**: Selector syntax and `getState()` (compiler doesn't optimize these)
- **Debouncing**: 2s auto-save prevents excessive operations
- **Effect cleanup**: Use `cancelled` flags in async effects
- **Measurement first**: Profile before adding manual memoization

**See `docs/developer/performance-patterns.md` for comprehensive React Compiler guidance and when manual optimization is still needed.**

## Best Practices

### Component Development

- **NEVER** use React Hook Form (infinite loops)
- **NEVER** destructure from Zustand stores (`const { ... } = useStore()`)
- **ALWAYS** use Direct Store Pattern with selector syntax
- **ALWAYS** use `useShallow` for object/array subscriptions
- **EXTRACT** helper components for repeated JSX (3+ times)
- **MEMOIZATION**: React Compiler handles automatically - avoid manual `useMemo`/`useCallback` unless profiling shows a need
- **EFFECT CLEANUP**: Use `cancelled` flags in async effects to prevent stale updates

### Module Development

- **EXTRACT** complex logic into `lib/`
- **CREATE** hooks for stateful logic
- **DEFINE** clear interfaces
- **WRITE** comprehensive tests
- **DOCUMENT** public APIs

## Troubleshooting

### Performance Issues

- **Excessive re-renders:** Check for destructuring from Zustand stores - use selector syntax instead
- **Components re-render on every keystroke:** Add `useShallow` to object/array subscriptions
- **Infinite loops:** Check Direct Store Pattern - ensure using selector syntax, not destructuring

### Common Issues

- **Auto-save:** Verify 2s interval and `scheduleAutoSave()`
- **Schema parsing:** Check `src/content/config.ts` syntax
- **Version conflicts:** Use v2/v4 docs only
- **Toast/Theme issues:** See `docs/developer/notifications.md`

**Quick Fix for Performance**: Search codebase for `const { .* } = use.*Store\(\)` and replace with selector syntax. See state-management.md for patterns.

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
- `docs/developer/notifications.md` - Toast notification system
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
