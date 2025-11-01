# Front-End Architecture Review

**Date:** November 1, 2025
**Scope:** Codebase-wide architectural analysis focusing on structure, maintainability, and logical data flow
**Excluded:** Event bridge pattern and god hook (already documented in backlog)

---

## Executive Summary

This codebase demonstrates **strong foundational architecture** with clear separation of concerns, modern React patterns, and thoughtful organization. The hybrid state management approach (TanStack Query + Zustand) is well-executed, and the layered architecture is generally respected.

**However**, there are **three architectural friction points** that significantly impact long-term maintainability and cognitive load for both human developers and AI agents:

1. **Lib → Store Circular Dependency** (10 files) 🔴 HIGH PRIORITY
2. **Hooks Exported from Lib Directory** (3 hooks) 🔴 HIGH PRIORITY
3. **Large, Multi-Responsibility Components** (4 files, 400-700 lines) 🟡 MEDIUM PRIORITY

**Overall Grade: B+ (Very Good with Specific Improvement Areas)**

---

## 1. Lib → Store Circular Dependency 🔴

### Issue

**10 modules in `/lib/` import from `/store/`**, violating the intended layered architecture:

```
lib (pure business logic)
  ↓
store (state management)
```

**Files affected:**
- `lib/commands/command-context.ts`
- `lib/commands/app-commands.ts`
- `lib/project-registry/effective-settings.ts`
- `lib/projects/actions.ts`
- `lib/ide.ts`
- `lib/editor/commands/editorCommands.ts`
- `lib/editor/extensions/copyedit-mode.ts`
- `lib/editor/dragdrop/handlers.ts`
- `lib/editor/dragdrop/fileProcessing.ts`
- `lib/editor/snippet-builder.ts`

### Why This Matters

**For Human Developers:**
- Violates expected dependency flow (lib should be reusable, store-agnostic)
- Makes lib modules harder to test in isolation (need to mock stores)
- Creates implicit coupling that's not obvious from directory structure
- Lib modules become less portable/reusable across projects

**For AI Agents:**
- Breaks the mental model of "lib = pure functions, no React/state"
- Makes it harder to reason about dependency chains
- Complicates refactoring suggestions (can't extract lib functions without considering store)
- Circular dependency risks make codebase traversal more complex

**For Long-term Maintainability:**
- New developers expect lib/ to be stateless utilities
- Future extraction/modularization is harder
- Testing pyramid is inverted (lib shouldn't depend on store)

### Patterns Found

#### Pattern A: Using `getState()` ✅ Acceptable
```typescript
// lib/projects/actions.ts
import { useProjectStore } from '../../store/projectStore'

export async function openProjectViaDialog() {
  useProjectStore.getState().setProject(projectPath) // One-way call
}
```

**Analysis:** This is a one-way dependency and doesn't create React coupling. The lib function calls store actions but doesn't subscribe to state. While not ideal, this is **low severity**.

#### Pattern B: Using Hooks ❌ Architectural Violation
```typescript
// lib/commands/command-context.ts
import { useEditorStore } from '../../store/editorStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'

export function useCommandContext(): CommandContext {
  const { currentFile, isDirty } = useEditorStore()
  const { data: collections } = useCollectionsQuery(...)
  // ...
}
```

**Analysis:** This file exports a **React hook** from the lib directory. It imports from both store AND hooks. This is a **high severity** violation because:
- It's not a "library module" - it's a React hook
- Should be in `/hooks/commands/useCommandContext.ts`
- Creates confusion about what lib/ contains

#### Pattern C: Mixed Hook + Pure Function ⚠️ Confusing
```typescript
// lib/project-registry/effective-settings.ts
import { useProjectStore } from '../../store/projectStore'

// Hook version
export const useEffectiveSettings = (collectionName?: string) => {
  const { currentProjectSettings } = useProjectStore()
  // ...
}

// Pure function version
export const getEffectiveSettings = (
  currentProjectSettings?: ProjectSettings | null,
  collectionName?: string
) => {
  // Pure logic, no store dependency
}
```

**Analysis:** File exports both a hook and a pure function. The hook should move to `/hooks/settings/`, while the pure function can stay in lib. This creates **moderate severity** confusion about module purpose.

### Recommendations

#### Priority 1: Move Hooks Out of Lib

**Files to move:**
1. `lib/commands/command-context.ts` → `hooks/commands/useCommandContext.ts`
2. `lib/project-registry/effective-settings.ts` → Extract `useEffectiveSettings` to `hooks/settings/useEffectiveSettings.ts`
3. Keep `getEffectiveSettings` pure function in lib (no store import needed)

**Impact:** Low risk, high clarity gain. These are pure file moves with import path updates.

**Implementation:**
```bash
# Move command context hook
mkdir -p src/hooks/commands
mv src/lib/commands/command-context.ts src/hooks/commands/useCommandContext.ts

# Extract settings hook
mkdir -p src/hooks/settings
# Create new file with useEffectiveSettings hook
# Keep getEffectiveSettings in lib/project-registry/effective-settings.ts
```

Update imports across codebase (likely 10-15 files).

#### Priority 2: Refactor Editor Extensions to Accept Parameters

**Files affected:**
- `lib/editor/extensions/copyedit-mode.ts`
- `lib/editor/dragdrop/fileProcessing.ts`
- `lib/editor/snippet-builder.ts`

**Current pattern:**
```typescript
// Extension imports and calls store
import { useProjectStore } from '../../../store/projectStore'

export function createExtension() {
  const { projectPath } = useProjectStore.getState()
  // Use projectPath
}
```

**Recommended pattern:**
```typescript
// Component passes needed data
export function createExtension(projectPath: string, currentFile: FileEntry | null) {
  // Pure function, no store dependency
}
```

**Benefits:**
- Extensions become pure, testable functions
- No hidden dependencies
- Easier to reason about and refactor

**Effort:** Medium - requires updating call sites in components.

#### Priority 3: Clarify Command Module Architecture

**Current:** `lib/commands/` contains command definitions + context provider
**Issue:** Commands are orchestration layer (not pure lib), and context is a hook

**Recommendation:** Two options:

**Option A: Move entire command system to hooks**
```
hooks/
  commands/
    useCommandContext.ts (moved from lib)
    useCommandPalette.ts (already exists)
lib/
  commands/
    types.ts (keep - pure types)
    app-commands.ts (move to hooks/commands/definitions.ts)
```

**Option B: Keep as orchestration layer**
```
lib/
  orchestration/  (rename from commands)
    command-registry.ts
    types.ts
hooks/
  commands/
    useCommandContext.ts
```

**Recommendation:** Option A is cleaner. Commands are React-centric (they trigger UI updates, use hooks), so they belong in hooks.

### Success Criteria

- [ ] Zero lib/ modules import from store/
- [ ] All hooks exported from hooks/, not lib/
- [ ] Lib modules are pure functions that accept parameters
- [ ] Clear documentation in architecture guide about dependency rules

---

## 2. Hooks Exported from Lib Directory 🔴

### Issue

**3 React hooks are exported from `/lib/`** instead of `/hooks/`:

| Hook | Location | Should Be |
|------|----------|-----------|
| `useCommandContext` | `lib/commands/command-context.ts` | `hooks/commands/useCommandContext.ts` |
| `useEffectiveSettings` | `lib/project-registry/effective-settings.ts` | `hooks/settings/useEffectiveSettings.ts` |
| `useTheme` | `lib/theme-provider.tsx` | OK (provider pattern) |

**Note:** `useTheme` is acceptable because `theme-provider.tsx` is a React context provider, which is a standard pattern.

### Why This Matters

**Directory Purpose Confusion:**
- `/lib/` should contain pure TypeScript utilities, business logic, and helper functions
- `/hooks/` should contain React hooks and component lifecycle logic
- Mixing hooks into lib creates cognitive overhead: "Is this file React-dependent or pure?"

**AI Agent Comprehension:**
- AI agents expect clear boundaries: lib = pure, hooks = React
- When asked "find hooks for settings", agents look in /hooks/, not /lib/
- Violates principle of least surprise

**Developer Onboarding:**
- New developers expect hooks in /hooks/
- Discoverability: Looking for a settings hook? Check /hooks/, not /lib/project-registry/

**Testability:**
- Hooks in lib/ signal "maybe this is pure?" but it requires React Testing Library
- Clear location makes testing strategy obvious

### Current Inconsistency

The codebase already has well-organized hooks:
```
hooks/
  editor/          (4 editor-specific hooks)
  mutations/       (4 TanStack Query mutation hooks)
  queries/         (6 TanStack Query query hooks)
  usePreferences.ts
  useCreateFile.ts
  etc.
```

The lib/ hooks break this otherwise consistent pattern.

### Recommendations

#### Move `useCommandContext` to hooks/commands/

**Before:**
```
lib/commands/
  command-context.ts (exports useCommandContext hook)
  app-commands.ts
  types.ts
```

**After:**
```
hooks/commands/
  useCommandContext.ts (moved)
  index.ts (barrel export)

lib/commands/
  app-commands.ts
  types.ts
```

**Updates needed:**
- Move file
- Update imports in ~5-10 files
- Add barrel export in hooks/commands/index.ts

#### Move `useEffectiveSettings` to hooks/settings/

**Before:**
```typescript
// lib/project-registry/effective-settings.ts
export const useEffectiveSettings = (collectionName?: string) => { ... }
export const getEffectiveSettings = (...) => { ... }
```

**After:**
```typescript
// hooks/settings/useEffectiveSettings.ts
export const useEffectiveSettings = (collectionName?: string) => { ... }

// lib/project-registry/effective-settings.ts
export const getEffectiveSettings = (...) => { ... } // Pure function stays
```

**Benefits:**
- Hook is discoverable in hooks/
- Pure function stays in lib/ for non-React usage
- Clear separation of concerns

**Updates needed:**
- Create hooks/settings/ directory
- Extract hook to new file
- Update imports in ~15-20 files
- Update architecture guide with this as an example pattern

### Success Criteria

- [ ] All React hooks exported from hooks/
- [ ] Lib/ contains only pure functions, types, and classes
- [ ] Architecture guide documents: "If it uses React hooks, it belongs in hooks/"

---

## 3. Large, Multi-Responsibility Components 🟡

### Issue

**4 components exceed 400 lines**, indicating multiple responsibilities:

| Component | Lines | Responsibilities |
|-----------|-------|-----------------|
| `ui/sidebar.tsx` | 724 | shadcn sidebar component with 10+ variants |
| `preferences/panes/CollectionSettingsPane.tsx` | 523 | All collection settings + field mapping + default file type |
| `layout/LeftSidebar.tsx` | 492 | Collection list + file list + breadcrumbs + filtering + context menus |
| `component-builder/ComponentBuilderDialog.tsx` | 398 | Form + preview + file management |

### Why This Matters

**Cognitive Load:**
- 500-line components require scrolling through multiple screens
- Hard to keep mental model of entire component
- AI agents struggle to provide targeted suggestions (context window fills quickly)

**Testing Difficulty:**
- Large components have many code paths
- Hard to test specific features in isolation
- Setup requires mocking many dependencies

**Modification Risk:**
- Changes to one section may inadvertently affect another
- Harder to review PRs (large diffs)
- Multiple developers can't work on same file easily

**Performance:**
- Harder to optimize rendering (can't memoize sub-sections easily)
- All logic re-runs on any state change in the component

### Analysis by Component

#### 3.1 `ui/sidebar.tsx` (724 lines) - shadcn Component

**Scope:** This is a third-party shadcn/ui component providing sidebar UI primitives.

**Recommendation:** **Low priority** - This is vendor code, not application logic. Only refactor if you're customizing it heavily and it becomes maintenance burden.

#### 3.2 `CollectionSettingsPane.tsx` (523 lines)

**Responsibilities:**
1. Collection selection/expansion UI
2. Field mapping settings (frontmatter fields to schema fields)
3. Default file type settings (markdown vs MDX)
4. Schema field parsing and display
5. Settings persistence

**Extraction Opportunities:**

```typescript
// Current: All in one file
export const CollectionSettingsPane: React.FC = () => {
  // 50 lines: Collection expansion state
  // 100 lines: Field mapping logic
  // 100 lines: Default file type logic
  // 200 lines: Rendering all of the above
  // 73 lines: Per-collection settings section rendering
}

// Recommended: Extract sub-components
export const CollectionSettingsPane: React.FC = () => {
  return (
    <SettingsSection>
      {collections.map(collection => (
        <CollectionSettingsItem
          key={collection.name}
          collection={collection}
          currentSettings={getCollectionSettings(...)}
          onUpdate={updateCollectionSettings}
        />
      ))}
    </SettingsSection>
  )
}

// New file: CollectionSettingsItem.tsx
const CollectionSettingsItem: React.FC<Props> = ({
  collection,
  currentSettings,
  onUpdate
}) => {
  return (
    <Collapsible>
      <FieldMappingSettings {...} />
      <DefaultFileTypeSettings {...} />
    </Collapsible>
  )
}

// New file: FieldMappingSettings.tsx
const FieldMappingSettings: React.FC = () => { /* 100 lines */ }

// New file: DefaultFileTypeSettings.tsx
const DefaultFileTypeSettings: React.FC = () => { /* 100 lines */ }
```

**Benefits:**
- Main pane becomes ~100 lines (just orchestration)
- Each setting type is independently testable
- Can optimize rendering per-setting-type
- AI agents can focus on specific setting types

**Effort:** Medium - Extract 3 components, update tests

#### 3.3 `LeftSidebar.tsx` (492 lines)

**Responsibilities:**
1. Project opening UI (when no project)
2. Collection selection dropdown
3. File filtering (drafts only toggle)
4. File list rendering with sorting
5. Subdirectory navigation (breadcrumbs + folder click)
6. Context menu integration
7. File selection/opening
8. Empty state handling
9. Loading/error states

**Extraction Opportunities:**

```typescript
// Current: Monolithic
export const LeftSidebar: React.FC = () => {
  // 50 lines: State management
  // 100 lines: Filtering/sorting logic
  // 100 lines: Event handlers
  // 242 lines: Rendering (collections dropdown + files list + breadcrumbs + empty states)
}

// Recommended: Domain-based extraction
export const LeftSidebar: React.FC = () => {
  return (
    <div>
      {!projectPath ? (
        <NoProjectState onOpenProject={openProjectViaDialog} />
      ) : (
        <>
          <SidebarHeader
            collections={collections}
            selectedCollection={selectedCollection}
            onSelectCollection={setSelectedCollection}
            showDraftsOnly={showDraftsOnly}
            onToggleDraftsOnly={handleToggleDraftsOnly}
          />

          <BreadcrumbNavigation
            currentSubdirectory={currentSubdirectory}
            onNavigate={navigateToSubdirectory}
          />

          <FilesList
            files={filteredAndSortedFiles}
            subdirectories={subdirectories}
            currentFile={currentFile}
            onFileSelect={handleFileClick}
            onSubdirectoryClick={handleSubdirectoryClick}
            frontmatterMappings={frontmatterMappings}
            isLoading={isLoadingDirectory}
            error={hasDirectoryError ? directoryError : null}
          />
        </>
      )}
    </div>
  )
}

// Extract to: components/layout/sidebar/
//   NoProjectState.tsx
//   SidebarHeader.tsx
//   BreadcrumbNavigation.tsx
//   FilesList.tsx
//   index.ts (barrel export)
```

**Benefits:**
- Main sidebar becomes ~80 lines (composition only)
- FilesList is independently testable (critical for sorting/filtering logic)
- Can optimize file list rendering separately
- Clear separation: header (controls) vs navigation (breadcrumbs) vs content (files)

**Effort:** Medium-High - Extract 4 components, test file list logic

#### 3.4 `ComponentBuilderDialog.tsx` (398 lines)

**Responsibilities:**
1. Dialog state management
2. Form input for component metadata
3. Props builder (adding/removing props)
4. Preview rendering
5. File creation/saving
6. Schema generation

**Extraction Opportunities:**

```typescript
// Current: All-in-one
export const ComponentBuilderDialog: React.FC = () => {
  // 50 lines: State
  // 100 lines: Form logic
  // 100 lines: Props builder
  // 100 lines: File generation
  // 48 lines: Rendering
}

// Recommended: Separate form, preview, and file generation
export const ComponentBuilderDialog: React.FC = () => {
  return (
    <Dialog>
      <ComponentBuilderForm
        metadata={metadata}
        props={props}
        onMetadataChange={...}
        onPropsChange={...}
      />

      <ComponentPreview
        metadata={metadata}
        props={props}
      />

      <DialogFooter>
        <Button onClick={() => createComponent(metadata, props)}>Create</Button>
      </DialogFooter>
    </Dialog>
  )
}

// Extract to: components/component-builder/
//   ComponentBuilderForm.tsx (metadata inputs + props builder)
//   ComponentPreview.tsx (preview rendering)
//   useComponentGenerator.ts (file generation logic)
```

**Benefits:**
- Dialog becomes ~100 lines (orchestration)
- Form logic independently testable
- File generation logic extracted to hook (reusable)
- Preview can be tested with fixture data

**Effort:** Medium - Extract 2 components + 1 hook

### Recommendations

**Priority Order:**

1. **LeftSidebar.tsx** (High Impact)
   - Most complex, most used
   - File list logic is critical and should be independently tested
   - Clear extraction points (header, nav, list)
   - **Effort:** 4-6 hours

2. **CollectionSettingsPane.tsx** (Medium Impact)
   - Settings UI is complex but less frequently modified
   - Good candidate for extraction (clear setting types)
   - **Effort:** 3-4 hours

3. **ComponentBuilderDialog.tsx** (Low Impact)
   - Used less frequently
   - Already reasonably well-structured
   - Can defer until feature expansion needed
   - **Effort:** 2-3 hours

4. **ui/sidebar.tsx** (Skip)
   - Vendor component, low priority

### Implementation Pattern

For each extraction:

1. **Create subdirectory** for related components
2. **Extract dumbest component first** (pure presentation)
3. **Test extracted component** in isolation
4. **Extract next component**, pass data from parent
5. **Update parent to compose** extracted components
6. **Add barrel export** (index.ts)
7. **Update tests**

Example for LeftSidebar:
```bash
mkdir -p src/components/layout/sidebar
# Extract NoProjectState.tsx (simple, no dependencies)
# Extract BreadcrumbNavigation.tsx (simple nav logic)
# Extract SidebarHeader.tsx (dropdown + filter toggle)
# Extract FilesList.tsx (complex, needs most testing)
# Create index.ts barrel export
# Update LeftSidebar.tsx to compose
```

### Success Criteria

- [ ] No component exceeds 300 lines (excluding tests)
- [ ] Each component has a single, clear responsibility
- [ ] Complex components have extracted sub-components with tests
- [ ] File/directory naming reflects component hierarchy

---

## 4. Positive Patterns to Preserve ✅

While this review focuses on improvements, it's important to recognize strong patterns that should be **maintained and replicated**:

### 4.1 Direct Store Pattern (Excellent)

The frontmatter field components demonstrate textbook React + Zustand integration:

```typescript
const StringField: React.FC<StringFieldProps> = ({ name, label, required }) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  return (
    <Input
      value={value || ''}
      onChange={e => updateFrontmatterField(name, e.target.value)}
    />
  )
}
```

**Why this is excellent:**
- No prop drilling
- Minimal re-renders (only when specific state changes)
- No React Hook Form (avoiding infinite loop issues)
- Type-safe
- Easy to test

**Action:** Document this pattern prominently in architecture guide as the canonical example.

### 4.2 Query Keys Factory (Excellent)

```typescript
// lib/query-keys.ts
export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), 'files', collectionName] as const,
  directoryContents: (projectPath, collectionName, subdirectory) => [...],
  fileContent: (projectPath, fileId) => [...],
}
```

This is **textbook TanStack Query** architecture:
- Hierarchical keys (invalidate parent = invalidate children)
- Type-safe with `as const`
- Single source of truth
- Composable

**Action:** Reference this in architecture guide as the standard for query key management.

### 4.3 getState() Pattern for Callbacks (Excellent)

Used consistently throughout the codebase:

```typescript
const handleAction = useCallback(() => {
  // Get state inside callback, not as dependency
  const { currentFile, projectPath } = useEditorStore.getState()
  const { selectedCollection } = useProjectStore.getState()
  // Use data
}, []) // Empty or minimal dependencies
```

**Why this is excellent:**
- Prevents render cascades
- Stable callback references
- Avoids stale closure issues
- Better performance

**Action:** Already documented in architecture guide - continue enforcing.

### 4.4 Barrel Exports (Excellent)

Every major directory has index.ts barrel exports:
```typescript
// components/frontmatter/fields/index.ts
export { StringField } from './StringField'
export { NumberField } from './NumberField'
export { BooleanField } from './BooleanField'
// ...
```

**Benefits:**
- Clean imports: `import { StringField } from '@/components/frontmatter/fields'`
- Clear public API
- Easy to refactor internal structure

**Action:** Continue this pattern for all new directories.

### 4.5 Hybrid State Management (Excellent)

The separation of server state (TanStack Query) and client state (Zustand) is well-executed:

**Server State:** Collections, files, schemas (cached, invalidated)
**Client State:** Current file, dirty state, UI layout

No state duplication, clear boundaries, proper cache invalidation.

**Action:** Document this as the recommended pattern for new features.

---

## 5. Minor Observations (Low Priority)

These are architectural observations that are **not urgent** but worth noting:

### 5.1 Memoization Under-Utilization

Only **24 instances** of `useMemo`/`useCallback`/`React.memo` in entire codebase.

**Observation:** This may be fine if performance is acceptable. The `getState()` pattern already prevents most render cascades.

**Recommendation:**
- Only add memoization if performance profiling shows need
- Don't over-optimize without measurements
- Focus memoization on:
  - Expensive computations (file sorting/filtering)
  - Large lists (100+ items)
  - Complex objects passed as props

**Action:** Performance audit before adding memoization. Document findings.

### 5.2 Test Coverage Gaps

**Current:** 28 test files, focused on critical paths (stores, utilities, complex fields)

**Gaps:**
- Large components (LeftSidebar, CollectionSettingsPane) have no tests
- Hook tests limited to editor hooks
- Command system not tested

**Recommendation:**
- After extracting large components → add tests for extracted pieces
- Add integration tests for command execution flow
- Document testing strategy in architecture guide

**Priority:** Medium - address after component extraction.

### 5.3 Settings Access Patterns

Multiple ways to access settings creates inconsistency:

```typescript
// Pattern 1: Direct from store
const { currentProjectSettings } = useProjectStore()

// Pattern 2: Through effective settings hook
const { frontmatterMappings } = useEffectiveSettings(collectionName)

// Pattern 3: Direct function call
const settings = getEffectiveSettings(currentProjectSettings, collectionName)
```

**Recommendation:**
- After moving `useEffectiveSettings` to hooks/, document when to use which
- **Rule:** Components use hook, lib/store use function
- Add examples to architecture guide

**Priority:** Low - address during hook extraction.

---

## 6. Dependency Flow Analysis

### Current State

```
┌─────────────┐
│  components │ ──→ hooks ──→ lib
└─────────────┘      ↓         ↑ (VIOLATION: 10 files)
       ↓             ↓         │
       └──→ store ←──┘         │
                    ←──────────┘
```

### Target State

```
┌─────────────┐
│  components │ ──→ hooks ──→ lib (pure)
└─────────────┘      ↓
       ↓             ↓
       └──→ store ←──┘
              ↓
         (one-way only)
```

**Rules:**
1. **Lib** → No imports from store or hooks (pure functions only)
2. **Hooks** → Can import from lib and store
3. **Components** → Can import from hooks, lib, and store
4. **Store** → Can import from lib (utilities), no hooks

**Exceptions:**
- Store can use other store's `getState()` (one-way call, no subscription)
- Theme provider can export `useTheme` hook (context provider pattern)

---

## 7. Recommended Implementation Plan

### Phase 1: Fix Dependency Violations (HIGH PRIORITY)

**Goal:** Establish clear architectural boundaries

**Tasks:**
1. Move `useCommandContext` from lib to hooks (2 hours)
   - Create hooks/commands/useCommandContext.ts
   - Update ~10 imports
   - Update architecture guide

2. Move `useEffectiveSettings` from lib to hooks (2 hours)
   - Create hooks/settings/useEffectiveSettings.ts
   - Keep `getEffectiveSettings` pure function in lib
   - Update ~20 imports
   - Document pattern in architecture guide

3. Refactor editor extensions to accept parameters (4 hours)
   - Update copyedit-mode, dragdrop, snippet-builder
   - Pass projectPath/currentFile from components
   - Remove store imports from lib/editor/*
   - Update call sites

**Total:** ~8 hours
**Impact:** Establishes clean dependency boundaries, improves testability

### Phase 2: Extract Large Components (MEDIUM PRIORITY)

**Goal:** Improve component maintainability

**Tasks:**
1. Extract LeftSidebar.tsx (6 hours)
   - Create components/layout/sidebar/ directory
   - Extract NoProjectState, SidebarHeader, BreadcrumbNavigation, FilesList
   - Add tests for FilesList (sorting/filtering critical)
   - Update main LeftSidebar to compose

2. Extract CollectionSettingsPane.tsx (4 hours)
   - Create components/preferences/collection-settings/ directory
   - Extract CollectionSettingsItem, FieldMappingSettings, DefaultFileTypeSettings
   - Add tests for field mapping logic
   - Update main pane to compose

**Total:** ~10 hours
**Impact:** Improves readability, testability, and AI agent comprehension

### Phase 3: Documentation & Guidelines (LOW PRIORITY)

**Goal:** Prevent regressions, guide future development

**Tasks:**
1. Update architecture guide (2 hours)
   - Document dependency rules
   - Add examples of lib vs hooks
   - Add component extraction guidelines
   - Update with settings access patterns

2. Add architectural tests (2 hours)
   - ESLint rule: no lib imports from store (except getState)
   - ESLint rule: hooks must be in hooks/
   - Dependency cruiser config for architectural boundaries

**Total:** ~4 hours
**Impact:** Prevents future violations, guides new developers

---

## 8. Summary of Recommendations

### 🔴 High Priority (Must Fix)

| Issue | Impact | Effort | Files Affected |
|-------|--------|--------|----------------|
| Lib → Store circular dependency | High - violates architecture, hard to test | Medium (8 hours) | 10 files |
| Hooks in lib/ directory | Medium - confusing, breaks conventions | Low (2 hours) | 3 files |

**Total High Priority Effort:** ~10 hours

### 🟡 Medium Priority (Should Fix)

| Issue | Impact | Effort | Files Affected |
|-------|--------|--------|----------------|
| Large components | Medium - hard to maintain, test, understand | Medium-High (10 hours) | 4 files |
| Settings access inconsistency | Low - minor confusion | Low (1 hour) | ~20 files |

**Total Medium Priority Effort:** ~11 hours

### 🟢 Low Priority (Nice to Have)

| Issue | Impact | Effort | Files Affected |
|-------|--------|--------|----------------|
| Test coverage gaps | Low - current coverage is acceptable | Medium (6 hours) | 10+ files |
| Memoization under-utilization | Unknown - needs profiling | Variable | TBD |
| Documentation updates | Low - prevents future issues | Low (4 hours) | 1 file |

**Total Low Priority Effort:** ~10 hours

---

## 9. Conclusion

This codebase demonstrates **strong architectural foundations** with a few specific friction points. The issues identified are **contained and fixable** - not systemic problems requiring major rewrites.

**Key Strengths:**
- Well-decomposed Zustand stores (no god store)
- Excellent TanStack Query integration
- Consistent use of performance patterns (getState)
- Clear directory organization
- Good separation of server/client state

**Key Weaknesses:**
- Lib → store dependency violations (10 files)
- Hooks exported from lib (3 files)
- Some large components need extraction (4 files)

**Priority Focus:**
1. Fix dependency violations (8-10 hours) - **DO THIS FIRST**
2. Extract large components (10 hours) - **DO THIS SECOND**
3. Update documentation and add guardrails (4 hours) - **DO THIS LAST**

**Total Recommended Effort:** ~24 hours (3 days) to address all high and medium priority items.

**Expected Outcome:**
- A-grade architecture with clear boundaries
- Improved maintainability for humans and AI agents
- Better testability and debugging experience
- Stronger foundation for future growth

---

## Appendix A: Architecture Dependency Rules

**For future reference and AI agent guidance:**

### Directory Purpose

| Directory | Purpose | Can Import From | Cannot Import From | Exports |
|-----------|---------|-----------------|-------------------|---------|
| `lib/` | Pure business logic, utilities, classes | Other lib modules | store, hooks | Functions, classes, types |
| `hooks/` | React hooks, lifecycle logic | lib, store | - | Hooks |
| `store/` | Zustand state management | lib (for utilities) | hooks | Stores (hooks) |
| `components/` | React UI components | lib, hooks, store | - | Components |
| `types/` | Type definitions | - | - | Types, interfaces |

### Dependency Flow Rules

```
components → hooks → lib
    ↓         ↓
    └─→ store ─→ lib (utilities only)
```

**Valid Dependencies:**
- ✅ Component → Hook
- ✅ Component → Store (direct access pattern)
- ✅ Component → Lib
- ✅ Hook → Store
- ✅ Hook → Lib
- ✅ Store → Lib (utilities, no hooks)
- ✅ Store → Store (via getState() only, no subscription)

**Invalid Dependencies:**
- ❌ Lib → Store (except rare one-way getState calls)
- ❌ Lib → Hooks (never)
- ❌ Store → Hooks (never)

### React Hook Rules

**If a module exports a React hook (`use*`), it belongs in `hooks/`, not `lib/`.**

**Exception:** Context providers (ThemeProvider, QueryClientProvider) can live in lib/ if they're framework integrations.

### Testing Rules

**Test location mirrors source location:**
- `lib/foo.ts` → `lib/foo.test.ts` (pure function tests)
- `hooks/useBar.ts` → `hooks/useBar.test.ts` (React Testing Library)
- `components/Baz.tsx` → `components/Baz.test.tsx` (React Testing Library)

**Integration tests:** `src/__tests__/integration/` for cross-layer tests

---

**End of Review**

