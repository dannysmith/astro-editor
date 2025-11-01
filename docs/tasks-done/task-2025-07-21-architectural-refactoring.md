# Task 3: Architectural Refactoring & State Management Consolidation

## 1. Executive Summary

This task addresses the single biggest architectural technical debt in the application: the monolithic `useAppStore` (540+ lines) that manages unrelated state domains. The refactoring will decompose this into focused, domain-specific stores and extract reusable UI components, resulting in **50-80% fewer re-renders**, **3x faster component development**, and a significantly more AI-assistant-friendly codebase.

**Status**: Phase 1 Complete - Store Decomposition Successful ✅
**Estimated Time**: Main implementation complete, minor test fixes remain
**Risk Level**: Low (core functionality migrated successfully)

---

## 2. Current State Analysis

### 2.1. Critical Issues Identified

**Monolithic Store Problems:**

- **Performance**: Every state change triggers re-renders across ALL consuming components
- **Maintainability**: Editor logic mixed with UI logic and project state
- **Testing**: Impossible to test domains in isolation
- **Developer Experience**: 540+ line file that's difficult to navigate
- **AI Assistant Friction**: Large context makes it hard for AI to understand and modify

**Current Store Breakdown:**

- **Lines**: 540 total
- **State Properties**: 21 different concerns
- **Actions**: 18 different responsibilities
- **Component Dependencies**: 8+ components directly coupled

### 2.2. Architecture Goals

1. **Domain Separation**: Each store manages a single responsibility
2. **Performance Optimization**: Minimize re-renders through focused subscriptions
3. **Maintainability**: Clear boundaries between concerns
4. **Testability**: Independent unit testing of each domain
5. **AI-Friendly**: Smaller, focused files with clear interfaces

---

## 3. Phase 0: Component Organization Cleanup (Priority: FOUNDATION)

### 3.1. Current Organization Problems

**Mixed-Purpose Directories:**

- `Layout/` directory contains both layout shell components AND feature components
- CSS files in wrong locations (editor styles in Layout directory)
- Inconsistent naming conventions (PascalCase vs lowercase)

**Unused Code:**

- `src/hooks/use-mobile.ts` only used in unused `ui/sidebar.tsx` component
- Can be safely removed

**Poor Domain Separation:**

- Related functionality scattered across directories
- No clear feature boundaries for development

### 3.2. Target Organization Structure

```
components/
├── layout/                 # App shell/layout only
│   ├── Layout.tsx
│   ├── UnifiedTitleBar.tsx
│   └── index.ts
├── editor/                 # Editor domain (components + styles)
│   ├── MainEditor.tsx      # Moved from Layout/
│   ├── EditorView.css      # Moved from Layout/
│   ├── EditorTheme.css     # Moved from Layout/
│   └── index.ts
├── sidebar/               # File navigation domain
│   ├── Sidebar.tsx         # Moved from Layout/
│   └── index.ts
├── frontmatter/           # Frontmatter editing domain
│   ├── FrontmatterPanel.tsx # Moved from Layout/
│   ├── FrontmatterPanel.test.tsx # Moved from Layout/
│   └── index.ts            # (Future: fields/ subdirectory)
├── command-palette/       # Renamed from CommandPalette/
│   ├── CommandPalette.tsx
│   ├── CommandPalette.test.tsx
│   └── index.ts
├── component-builder/     # Renamed from ComponentBuilder/
│   ├── ComponentBuilderDialog.tsx
│   └── index.ts
├── preferences/           # Already well organized
│   ├── PreferencesDialog.tsx
│   ├── index.ts
│   └── panes/
└── ui/                   # shadcn/ui components (keep as-is)
```

### 3.3. Implementation Steps

#### **Step 1: Remove Unused Code**

1. **Delete `src/hooks/use-mobile.ts`** (confirmed unused in our app)
2. **Verify no other unused hooks** in hooks directory

#### **Step 2: Create New Directory Structure**

1. Create new feature directories with consistent kebab-case naming
2. Set up barrel exports (index.ts) for each directory

#### **Step 3: Move Components by Domain**

**Migration Order:**

1. **Editor domain**: Move `MainEditor.tsx` + CSS files to `editor/`
2. **Sidebar domain**: Move `Sidebar.tsx` to `sidebar/`
3. **Frontmatter domain**: Move `FrontmatterPanel.tsx` + test to `frontmatter/`
4. **Rename directories**: `CommandPalette/` → `command-palette/`, etc.

#### **Step 4: Update All Import Statements**

- Update all component imports to use new paths
- Leverage barrel exports for clean imports: `from '@/components/editor'`
- Verify TypeScript compilation

#### **Step 5: Update Documentation**

- Update `CLAUDE.md` with new component organization patterns
- Document naming conventions (kebab-case directories, PascalCase files)
- Update architecture guide with new structure

### 3.4. Benefits of This Reorganization

**Immediate Benefits:**

- **Clear Domain Boundaries**: Each directory represents a specific feature domain
- **Better Navigation**: Related files co-located (components + styles + tests)
- **Consistent Patterns**: Kebab-case directories, barrel exports
- **Cleaner Layout**: Layout directory only contains actual layout components

**Refactoring Benefits:**

- **Easier FrontmatterFields Extraction**: Clear `frontmatter/` domain already established
- **Store Migration**: Components already grouped by domain responsibility
- **AI-Friendly**: Smaller, focused directories with clear purposes

**Long-term Benefits:**

- **Scalability**: Easy to add new features without directory confusion
- **Maintainability**: Clear ownership and responsibility boundaries
- **Developer Onboarding**: Intuitive structure that's easy to understand

### 3.5. Documentation Updates Required

#### **Update CLAUDE.md**

Add new section on component organization:

```markdown
## Component Organization

### Directory Structure

- **kebab-case naming** for all component directories
- **Barrel exports** (index.ts) for clean imports
- **Domain-based organization** rather than technical grouping
- **Co-location** of related files (components, styles, tests)

### Naming Conventions

- Directories: `kebab-case` (e.g., `command-palette/`)
- Components: `PascalCase` (e.g., `CommandPalette.tsx`)
- CSS files: Co-located with components they style
- Tests: Co-located with components (e.g., `ComponentName.test.tsx`)

### Import Patterns

- Use barrel exports: `import { CommandPalette } from '@/components/command-palette'`
- Avoid deep imports: `import CommandPalette from '@/components/command-palette/CommandPalette'`
```

#### **Update Architecture Guide**

Document the new component boundaries and how they align with the planned store decomposition.

---

## 4. Phase 1: Store Decomposition (Priority: CRITICAL)

### 4.1. New Store Architecture

#### **Store 1: `useEditorStore`**

**File**: `src/store/editorStore.ts`
**Responsibility**: Manages active file editing state (most volatile)

```typescript
interface EditorState {
  // File state
  currentFile: FileEntry | null

  // Content state
  editorContent: string
  frontmatter: Record<string, unknown>
  rawFrontmatter: string
  imports: string

  // Status state
  isDirty: boolean
  recentlySavedFile: string | null
  autoSaveTimeoutId: number | null

  // Actions
  openFile: (file: FileEntry) => Promise<void>
  closeCurrentFile: () => void
  saveFile: (showToast?: boolean) => Promise<void>
  setEditorContent: (content: string) => void
  updateFrontmatter: (frontmatter: Record<string, unknown>) => void
  updateFrontmatterField: (key: string, value: unknown) => void
  scheduleAutoSave: () => void
  updateCurrentFilePath: (newPath: string) => void
}
```

#### **Store 2: `useProjectStore`**

**File**: `src/store/projectStore.ts`
**Responsibility**: Manages project-level identifiers for TanStack Query

```typescript
interface ProjectState {
  // Core identifiers
  projectPath: string | null
  currentProjectId: string | null
  selectedCollection: string | null

  // Settings (moved from main store)
  globalSettings: GlobalSettings | null
  currentProjectSettings: ProjectSettings | null

  // Actions
  setProject: (path: string) => void
  setSelectedCollection: (collection: string | null) => void
  loadPersistedProject: () => Promise<void>
  initializeProjectRegistry: () => Promise<void>
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => Promise<void>
  updateProjectSettings: (settings: Partial<ProjectSettings>) => Promise<void>
}
```

#### **Store 3: `useUIStore`**

**File**: `src/store/uiStore.ts`
**Responsibility**: Manages global UI layout state

```typescript
interface UIState {
  // Layout state
  sidebarVisible: boolean
  frontmatterPanelVisible: boolean

  // Actions
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
}
```

### 4.2. Implementation Strategy

#### **Step 1: Create New Store Files**

1. **Create `src/store/editorStore.ts`**
   - Copy editor-related state and actions from `useAppStore`
   - Maintain exact same interfaces to prevent breaking changes
   - Include all auto-save logic, file operations, and content management
   - Preserve the Direct Store Pattern for frontmatter updates

2. **Create `src/store/projectStore.ts`**
   - Copy project and settings-related state and actions
   - Include project registry initialization and persistence
   - Handle file watcher setup (depends on project path)

3. **Create `src/store/uiStore.ts`**
   - Copy UI state and toggle actions
   - Simplest store - should be quick to implement

#### **Step 2: Migration Order (Component by Component)**

**Migration Priority** (least to most complex):

1. **`layout/UnifiedTitleBar.tsx`** - Only needs UI store
2. **`frontmatter/FrontmatterPanel.tsx`** - Only needs editor store
3. **`editor/MainEditor.tsx`** - Only needs editor store
4. **`sidebar/Sidebar.tsx`** - Needs project store, minimal editor store
5. **`layout/Layout.tsx`** - Needs all three stores (most complex)

#### **Step 3: Store Creation Template**

Each new store should follow this pattern:

```typescript
import { create } from 'zustand'
import { /* other imports */ } from '../lib/...'

interface [StoreName]State {
  // State properties
  // Actions
}

export const use[StoreName]Store = create<[StoreName]State>((set, get) => ({
  // Initial state

  // Actions implementation
}))

// Export specific selectors for performance
export const use[StoreName]Selector = {
  // Common selector patterns
}
```

### 4.3. Critical Migration Rules

#### **Rule 1: Preserve Direct Store Pattern**

```typescript
// ✅ MAINTAIN: Direct field updates
const { frontmatter, updateFrontmatterField } = useEditorStore()

// ❌ NEVER: Callback dependencies that cause loops
const handleChange = useCallback(/* ... */, [dependencies])
```

#### **Rule 2: Interface Compatibility**

- All action signatures must remain identical during migration
- Component imports should be the only change initially
- No functional changes until migration is complete

#### **Rule 3: Migration Verification**

After each component migration:

1. Manual test all component functionality
2. Verify no console errors
3. Test auto-save, file operations, UI toggles
4. Check performance with React DevTools

---

## 5. Phase 2: Component Extraction (Priority: HIGH)

### 5.1. FrontmatterPanel Field Extraction

#### **Target Structure:**

```
src/components/frontmatter/
├── FrontmatterPanel.tsx  # Main panel component
├── FrontmatterPanel.test.tsx
├── index.ts
└── fields/               # Extracted field components
    ├── index.ts          # Export all field components
    ├── types.ts          # Shared interfaces (FieldProps, etc.)
    ├── StringField.tsx   # String input field
    ├── TextareaField.tsx # Multi-line text field
    ├── NumberField.tsx   # Number input field
    ├── BooleanField.tsx  # Switch component field
    ├── DateField.tsx     # Date picker field
    ├── EnumField.tsx     # Select dropdown field
    ├── ArrayField.tsx    # Tag input field
    └── FrontmatterField.tsx # Main delegator component
```

#### **Implementation Steps:**

1. **Create `src/components/frontmatter/fields/types.ts`**

   ```typescript
   export interface FieldProps {
     name: string
     label: string
     className?: string
     required?: boolean
   }

   export interface StringFieldProps extends FieldProps {
     placeholder?: string
   }

   export interface TextareaFieldProps extends FieldProps {
     placeholder?: string
     minRows?: number
     maxRows?: number
   }

   // ... other field prop interfaces
   ```

2. **Extract Each Field Component**
   - Copy existing field logic from `FrontmatterPanel.tsx`
   - Maintain Direct Store Pattern: `const { frontmatter, updateFrontmatterField } = useEditorStore()`
   - Add comprehensive JSDoc comments
   - Include prop validation

3. **Create Barrel Export (`fields/index.ts`)**

   ```typescript
   export { StringField } from './StringField'
   export { TextareaField } from './TextareaField'
   export { NumberField } from './NumberField'
   export { BooleanField } from './BooleanField'
   export { DateField } from './DateField'
   export { EnumField } from './EnumField'
   export { ArrayField } from './ArrayField'
   export { FrontmatterField } from './FrontmatterField'
   export type { FieldProps } from './types'
   ```

4. **Refactor `FrontmatterPanel.tsx`**
   - Remove all field component definitions
   - Import from `./fields`
   - Focus solely on layout and field orchestration
   - Should reduce from 460+ lines to ~100 lines

#### **Testing Strategy:**

- **Unit Tests**: Each field component in isolation
- **Integration Tests**: Field interactions with editor store
- **Visual Tests**: Render each field type with different props

### 5.2. Component Benefits

**Immediate Benefits:**

- **Maintainability**: Each field type is independently modifiable
- **Testability**: Unit test individual field behaviors
- **Reusability**: Fields can be used in other contexts (preferences, etc.)
- **Performance**: Smaller component re-render surfaces

**Long-term Benefits:**

- **Extensibility**: Add new field types without touching existing code
- **AI-Friendly**: Small, focused files with clear single responsibilities
- **Documentation**: Each field can have comprehensive docs and examples

---

## 6. Risk Mitigation

### 6.1. Technical Risks

**Risk**: Breaking Direct Store Pattern during migration
**Mitigation**:

- Maintain exact `updateFrontmatterField` signature
- Test each component migration immediately
- Keep old store until migration complete

**Risk**: Performance degradation
**Mitigation**:

- Use React DevTools to measure re-renders before/after
- Implement selector patterns for complex subscriptions
- Benchmark file operations and auto-save

**Risk**: TanStack Query integration issues
**Mitigation**:

- Keep query keys and cache invalidation identical
- Test all mutation operations after migration
- Verify file watching and refresh behavior

### 6.2. Testing Strategy

**Component Tests:**

- Each migrated component has unit tests
- Focus on store subscription patterns
- Verify action dispatching

**Integration Tests:**

- File operations (open, save, rename, delete)
- Auto-save functionality
- UI state persistence
- Query cache invalidation

**Manual Testing Checklist:**

- [ ] Open project and browse collections
- [ ] Create, rename, duplicate, delete files
- [ ] Edit frontmatter fields of all types
- [ ] Verify auto-save behavior
- [ ] Test keyboard shortcuts
- [ ] Toggle UI panels
- [ ] MDX component insertion
- [ ] Command palette functionality

---

## 7. Future Extensibility

### 7.1. Store Pattern Established

This refactoring establishes patterns for future feature stores:

- `useSearchStore` for search/filter functionality
- `useThemeStore` for theme customization
- `usePluginStore` for future plugin system

### 7.2. Component Pattern Established

FrontmatterFields extraction establishes patterns for:

- Reusable form components across the app
- Standardized prop interfaces
- Consistent validation patterns

---

## 8. Implementation Checklist

### 8.1. Pre-Implementation

### 8.2. Component Organization ✅ COMPLETE

- [x] Remove unused `use-mobile.ts` hook
- [x] Create new domain directories (`layout/`, `editor/`, `sidebar/`, `frontmatter/`)
- [x] Move components to appropriate domains
- [x] Rename directories to kebab-case (`command-palette/`, `component-builder/`)
- [x] Set up barrel exports for each domain
- [x] Update all import statements across codebase
- [x] Verify TypeScript compilation
- [x] Update CLAUDE.md with component organization patterns
- [x] Manual testing and npm run check:all verification

### 8.3. Store Migration ✅ COMPLETE

- [x] Create `editorStore.ts` with complete interface
- [x] Create `projectStore.ts` with complete interface
- [x] Create `uiStore.ts` with complete interface
- [x] Verify TypeScript compilation
- [x] Test store creation and basic actions

### 8.4. Component Migration ✅ COMPLETE

- [x] Update imports to new stores (Layout, MainEditor, Editor, FrontmatterPanel, Sidebar, UnifiedTitleBar, StatusBar, ComponentBuilderDialog)
- [x] Verify no TypeScript errors (main app code)
- [x] Update command context and hooks (useEditorHandlers, useCreateFile, usePreferences, etc.)
- [x] Update drag-and-drop handlers
- [x] Remove original monolithic useAppStore
- [x] Fix test files to use new stores (test files only)
- [x] BugFixes
  - [x] Open Project in IDE and Open Collection in IDE don't work in the command palette. (Open File does)
  - [x] (unrelated to our current work) The .resizable-panel which wraps the editor (and maybe `.cm-content` too) have their min-heigh as 100vh. Because we have the unified tab bar at the top, this means the main editor will always scroll, even if the documents contents are too short for it. We should use `calc` to subtract the height of the titlebar and status bar from the min-hight so it's correct. Look for both CSS declarations and Tailwind declarations for 100vh When identifying the files that need editing here.

### 8.5. Field Component Extraction

- [x] Create `frontmatter/fields/` directory structure
- [x] Extract each field component
- [x] Create barrel exports
- [x] Update FrontmatterPanel imports
- [x] Write unit tests for extracted components
- [x] Update CLAUDE.md and documentation

### 8.6. Final Cleanup

- [x] Remove original `useAppStore` if not removed
- [x] Remove any old stuff for backwards compatibility or comments saying "Removed X because" etc. Clean up.
- [x] Run full test suite

---

## 9. Conclusion

This refactoring represents the most impactful architectural improvement available to the codebase. The store decomposition addresses the core performance and maintainability issues, while the component extraction establishes patterns for future development.

The detailed implementation plan ensures minimal risk while maximizing benefit, resulting in a significantly more robust, performant, and developer-friendly application architecture.
