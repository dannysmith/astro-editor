# Task: Event Bridge Refactor

## Overview

The application currently uses a "Bridge Pattern" where Zustand stores dispatch global `window` custom events to trigger actions in React components that have access to TanStack Query data. This pattern exists to solve a real constraint: Zustand stores cannot use React hooks, but they need data from TanStack Query (which requires hooks).

**Current Status**: Active in production code. Not causing bugs, but creates technical debt.

**Priority**: Post-1.0.0 architectural improvement (not a critical bug)

## Current Implementation

### Pattern 1: Schema Field Order (Save File Flow)

**Location**: `src/store/editorStore.ts` (lines 264-309) ↔ `src/components/frontmatter/FrontmatterPanel.tsx` (lines 42-77)

When saving a file, the store needs schema field order from TanStack Query:

```typescript
// Store dispatches request event
const schemaEvent = new CustomEvent('get-schema-field-order', {
  detail: { collectionName: currentFile.collection },
})
window.dispatchEvent(schemaEvent)

// Polls every 10ms for response
await new Promise(resolve => {
  const checkResponse = () => {
    if (responseReceived) {
      resolve(null)
    } else {
      setTimeout(checkResponse, 10)  // 🔥 POLLING ANTI-PATTERN
    }
  }
  checkResponse()
})
```

FrontmatterPanel listens and responds:

```typescript
useEffect(() => {
  const handleSchemaFieldOrderRequest = (event: Event) => {
    const collections = /* from TanStack Query */
    const fieldOrder = /* extract from schema */

    window.dispatchEvent(new CustomEvent('schema-field-order-response', {
      detail: { fieldOrder }
    }))
  }

  window.addEventListener('get-schema-field-order', handleSchemaFieldOrderRequest)
  return () => window.removeEventListener(...)
}, [collections])
```

### Pattern 2: Create New File

**Location**: `src/lib/commands/command-context.ts`, `src/hooks/useLayoutEventListeners.ts` (lines 104, 176-178)

Commands and shortcuts dispatch `create-new-file` event, which is handled by useLayoutEventListeners that has access to TanStack Query data.

## Technical Problems

1. **Polling**: Checking every 10ms is wasteful and fragile
2. **No type safety**: `CustomEvent<any>` - TypeScript can't help
3. **Debugging nightmare**: Must trace flow across multiple files via global events
4. **Race conditions**: Event listeners might not be registered when events fire
5. **Testing complexity**: Can't easily test event chains
6. **Memory leaks**: Easy to forget event cleanup
7. **Invisible coupling**: No clear dependency relationship in code

## Why This Pattern Exists

**The Core Constraint**: The architecture follows an "onion pattern":
1. TanStack Query (outer) - server/filesystem data
2. Zustand (middle) - client state
3. useState (inner) - local UI state

The middle layer (Zustand) is trying to reach outward to the outer layer (TanStack Query), which violates the dependency flow. The event bridge is a workaround.

## Recommended Solution: Hybrid Action Hooks

**Source**: `docs/reviews/event-bridge-refactor-analysis.md` (comprehensive 572-line analysis)

### Core Insight

Different types of actions have different architectural needs:
- **User-triggered actions** (Save button, keyboard shortcuts) → Should live in **hooks**
- **State-triggered actions** (Auto-save, dirty tracking) → Should live in **stores**

### Architecture

**Stores**: State + state-triggered logic only
```typescript
const useEditorStore = create<EditorState>((set, get) => ({
  // State
  editorContent: '',
  isDirty: false,
  autoSaveCallback: null as (() => Promise<void>) | null,

  // Register callback from hook
  setAutoSaveCallback: (callback) => set({ autoSaveCallback: callback }),

  // State mutations trigger auto-save
  setEditorContent: (content) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()  // State-triggered
  },

  // Auto-save scheduling (state logic only)
  scheduleAutoSave: () => {
    const { autoSaveCallback } = get()
    if (autoSaveCallback) {
      setTimeout(() => void autoSaveCallback(), 2000)
    }
  },

  markAsSaved: () => set({ isDirty: false }),
}))
```

**Hooks**: User-triggered actions with natural access to both stores and queries
```typescript
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async (showToast = true) => {
    // Direct access to stores via getState()
    const { currentFile, frontmatter, editorContent } = useEditorStore.getState()
    const { projectPath } = useProjectStore.getState()

    // Direct access to query data - NO EVENTS!
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    const schema = collections?.find(c => c.name === currentFile.collection)?.schema
    const schemaFieldOrder = schema?.fields.map(f => f.name) || null

    await invoke('save_markdown_content', {
      filePath: currentFile.path,
      frontmatter,
      content: editorContent,
      schemaFieldOrder,
      projectRoot: projectPath,
    })

    useEditorStore.getState().markAsSaved()
    await queryClient.invalidateQueries({ ... })
    if (showToast) toast.success('File saved')
  }, [queryClient])

  return { saveFile }
}
```

**Layout**: Wire everything together
```typescript
export function Layout() {
  const { saveFile } = useEditorActions()

  // Register auto-save callback with store
  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
  }, [saveFile])
}
```

### Benefits

✅ **No polling** - Synchronous data access
✅ **Type-safe** - TypeScript enforces everything
✅ **Testable** - Can test hooks and stores independently
✅ **No race conditions** - Standard React lifecycle
✅ **No memory leaks** - Standard cleanup patterns
✅ **Easy debugging** - Clear call paths
✅ **Follows React patterns** - Hook composition is idiomatic
✅ **Aligns with architecture guide** - "Reusable UI Logic → hooks"

## Alternative: Callback Registry

If stores MUST contain all business logic (not just state), second-best option:

```typescript
class QueryDataRegistry {
  private getCollections: ((projectPath: string) => Collection[]) | null = null

  registerCollectionsGetter(fn) { this.getCollections = fn }
  getCollectionsData(projectPath) { return this.getCollections?.(projectPath) }
}

// Store uses it synchronously
const collections = queryDataRegistry.getCollectionsData(projectPath)

// Layout registers
useEffect(() => {
  queryDataRegistry.registerCollectionsGetter((path) =>
    queryClient.getQueryData(queryKeys.collections(path))
  )
}, [])
```

Still adds indirection, but at least it's type-safe and synchronous (no polling).

## Migration Path

### Phase 1: Extract `saveFile` to Hook
1. Create `hooks/editor/useEditorActions.ts`
2. Implement `saveFile` in hook with direct queryClient access
3. Update store to accept auto-save callback
4. Wire in Layout component
5. Update all call sites (keyboard shortcuts, buttons)
6. Remove event bridge code for schema-field-order

**Effort**: 2-3 hours

### Phase 2: Apply Pattern to Other Actions
1. `createNewFile` → Move to hook
2. `deleteFile` → Move to hook
3. Other orchestration actions

**Effort**: 1-2 hours each

### Phase 3: Clean Up
1. Remove all event bridge infrastructure
2. Update architecture guide with new pattern
3. Add tests for hooks and store interactions

**Effort**: 1-2 hours

**Total**: ~1 day

## Assessment

**My Take**: The review correctly identifies this as architecturally inelegant. The Hybrid Action Hooks pattern is genuinely better and more maintainable. However, the current implementation works and isn't causing bugs. This is architectural aesthetics, not reliability.

**When to do this**: After critical bugs are fixed (auto-save data loss, YAML parser). This is a post-1.0.0 architectural enhancement that improves developer experience and maintainability but doesn't fix any user-facing issues.

## References

- Full analysis: `docs/reviews/event-bridge-refactor-analysis.md` (572 lines)
- Original review: `docs/reviews/staff-engineer-review-2025-10-24.md` (section 1)
- Current implementation:
  - `src/store/editorStore.ts:264-309` (save file + event bridge)
  - `src/components/frontmatter/FrontmatterPanel.tsx:42-77` (event listener)
  - `src/hooks/useLayoutEventListeners.ts:104,176-178` (create-new-file event)

---

# Deep Research & Architectural Analysis

**Research Date**: November 1, 2025
**Methodology**: Expert consultation (React Performance Architect, Tauri v2 Expert) + Industry research + First principles analysis

## Executive Summary

After comprehensive research including expert consultation and industry analysis, **two architectural patterns emerge as viable solutions**, each with distinct trade-offs:

1. **Hybrid Action Hooks** (React-first approach): User-triggered actions live in hooks, state logic lives in stores
2. **Callback Registry** (Tauri-first approach): All logic lives in stores, with synchronous bridge to query data

**Key Finding**: Both patterns completely eliminate the technical debt of the current event bridge (polling, type safety, race conditions). The choice between them depends on **philosophical preference about where business logic should live** rather than technical superiority.

**Recommendation**: **Hybrid Action Hooks** for this codebase, based on:
- Better alignment with existing React-heavy architecture
- Lower complexity (no new abstraction to learn)
- Natural fit with React 19 patterns
- Team familiarity with custom hooks pattern

## Expert Consultation Findings

### React Performance Architect Analysis

**Core Assessment**: "The Hybrid Action Hooks approach is architecturally sound and represents the best long-term solution."

#### Architecture Evaluation

**Pattern Breakdown**:
```typescript
// 1. Stores: State + state-triggered logic
const useEditorStore = create((set, get) => ({
  editorContent: '',
  isDirty: false,
  autoSaveCallback: null,

  setAutoSaveCallback: (cb) => set({ autoSaveCallback: cb }),

  setEditorContent: (content) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave() // State-triggered
  },
}))

// 2. Hooks: User-triggered actions
function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async () => {
    const { currentFile, frontmatter } = useEditorStore.getState()
    const collections = queryClient.getQueryData(queryKeys.collections())
    // Direct access to both - no events!
  }, [queryClient])

  return { saveFile }
}

// 3. Layout: Wire together
function Layout() {
  const { saveFile } = useEditorActions()
  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
  }, [saveFile])
}
```

**Why This Works**:
1. **Follows React Idioms**: Hook composition is the canonical React pattern
2. **Clear Data Flow**: Easy to trace from trigger → hook → store → backend
3. **Type Safety**: Full TypeScript inference chain
4. **Testability**: Can test hooks, stores, and integration separately
5. **Performance**: No polling, stable callbacks (`useCallback([queryClient])` never recreates)

#### Performance Analysis

**Current Pattern**:
- 10ms polling loop wastes ~100 CPU cycles per save
- Memory risk from event listener accumulation
- Invisible performance costs

**Hybrid Action Hooks**:
- Synchronous data access (no polling)
- Stable callbacks (queryClient never changes, so callback is stable)
- Minimal re-render impact (only Layout when hook changes, which is never)
- **Performance Winner**: Eliminates 100% of polling overhead

#### Comparison with Alternatives

| Pattern | Type Safety | Performance | Testability | Complexity | Verdict |
|---------|-------------|-------------|-------------|------------|---------|
| **Current (Events + Polling)** | ❌ None | ❌ 10ms poll overhead | ❌ Complex mocking | Medium | Remove |
| **Callback Registry** | ✅ Full | ✅ Sync access | ⚠️ Need registry mock | Medium-High | Good |
| **Hybrid Action Hooks** | ✅ Full | ✅ Sync access | ✅ Standard mocking | Low | Best |
| **Direct QueryClient Import** | ✅ Full | ✅ Sync access | ❌ Hard to mock | Low | ❌ Violates architecture |

**React 19 Considerations**:
- `use()` hook doesn't solve this (problem is about code organization, not async handling)
- Concurrent features don't apply (not a rendering issue)
- Server Components not applicable (Tauri desktop app)

**Verdict**: React 19 doesn't provide better solutions than Hybrid Action Hooks.

#### Implementation Guidance

**Critical Insight**: Different action types have different architectural homes:

| Action Type | Trigger | Needs Query? | Needs Store? | Best Location |
|-------------|---------|--------------|--------------|---------------|
| Auto-save | State change | ✅ | ✅ | Store + Hook callback |
| User save | Button/Shortcut | ✅ | ✅ | Hook |
| Set content | Editor change | ❌ | ✅ | Store |
| Create file | Button/Shortcut | ✅ | ✅ | Hook |
| Toggle panel | Button/Shortcut | ❌ | ✅ | Store |

**Pattern**: State management → Store. Orchestration with external data → Hook.

#### Maintainability Assessment (2-3 Year Horizon)

**Pros**:
- Standard React patterns (new developers understand immediately)
- Clear data flow (easy debugging)
- Testable (independent layer testing)
- Type-safe (compile-time error catching)
- Well-documented (fits existing architecture guide)

**Cons**:
- Callback wiring boilerplate in Layout
- Split concerns (action logic in hooks, state logic in stores)

**Long-term Verdict**: "Significantly more maintainable than current approach. Clear improvement across all dimensions."

### Tauri v2 Expert Analysis

**Core Assessment**: "Use the Callback Registry pattern—it's Tauri-appropriate, performant, and idiomatic for production Tauri apps."

#### Critical Tauri Insight

**Key Point**: "This is a frontend architecture problem, not a Tauri IPC problem."

Using Tauri events (`emit`, `listen`) for Zustand-TanStack Query coordination would be an **architectural anti-pattern**:
- Tauri events are for **native-frontend communication**
- Not for coordinating frontend state management libraries
- Would add unnecessary serialization overhead
- Would cross boundaries inappropriately

#### Recommended Pattern: Callback Registry

```typescript
// src/lib/query-bridge.ts
type QueryDataGetter<T> = () => T | undefined

class QueryBridge {
  private getters = new Map<string, QueryDataGetter<any>>()

  register<T>(key: string, getter: QueryDataGetter<T>): void {
    this.getters.set(key, getter)
  }

  get<T>(key: string): T | undefined {
    const getter = this.getters.get(key)
    return getter ? getter() : undefined
  }
}

export const queryBridge = new QueryBridge()
```

**Store Integration**:
```typescript
// src/store/editorStore.ts
import { queryBridge } from '@/lib/query-bridge'

export const useEditorStore = create((set, get) => ({
  createNewFile: async (collectionName: string) => {
    // Direct synchronous access to query data
    const collections = queryBridge.get<Collection[]>('collections')
    if (!collections) return

    const collection = collections.find(c => c.name === collectionName)
    if (!collection) return

    // Single Tauri command invocation
    const result = await invoke('create_file', {
      path: collection.path,
      name: 'new-file.md'
    })

    set({ currentFile: result })
  }
}))
```

**React Registration**:
```typescript
// src/components/layout/Layout.tsx
useEffect(() => {
  queryBridge.register('collections', () =>
    queryClient.getQueryData(queryKeys.collections(projectPath))
  )

  return () => queryBridge.unregister('collections')
}, [projectPath, queryClient])
```

#### Why This Excels in Tauri v2

**1. Optimal IPC Performance**

Store has all context needed to make single, well-formed Tauri command call:
```typescript
createAndOpenFile: async (collectionName: string) => {
  const collections = queryBridge.get<Collection[]>('collections')
  const collection = collections?.find(c => c.name === collectionName)
  if (!collection) return

  // Single Tauri command - no polling, no multiple IPC calls
  const file = await invoke('create_file', {
    collectionPath: collection.path,
    template: collection.schema.defaultTemplate
  })

  set({ currentFile: file })
}
```

**2. Natural Tauri Architecture Alignment**

Tauri v2 expects:
- **Commands** return data to frontend
- **Events** notify frontend of native state changes
- **Frontend manages its own UI state**

Callback Registry keeps frontend coordination in frontend code, while Tauri handles native boundary.

**3. Multi-Window Scalability**

When expanding to multiple windows:
```typescript
// Each window has own QueryClient and bridge registration
// Windows communicate via Tauri events, not query bridge

// Window 1 (main editor)
useEffect(() => {
  const unlisten = listen('file-created', (event) => {
    queryClient.invalidateQueries(queryKeys.collectionFiles())
  })
  return () => { unlisten.then(fn => fn()) }
}, [])

// Window 2 (preview) - separate QueryClient, separate bridge
queryBridge.register('currentFile', () =>
  queryClient.getQueryData(queryKeys.fileContent(currentPath))
)
```

#### Tauri-Specific Enhancements

**1. Leverage Rust State for Global Context**:
```rust
// src-tauri/src/state.rs
pub struct AppState {
    pub project_path: Mutex<Option<String>>,
    pub watched_collections: Mutex<Vec<String>>,
}
```

**2. Use Tauri Events for Filesystem Changes**:
```rust
// Rust emits events when files change
app.emit_all("file-changed", FileChangePayload { ... }).unwrap();
```
```typescript
// Frontend invalidates cache
useEffect(() => {
  const unlisten = listen<FileChangePayload>('file-changed', (event) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.collectionFiles(...) })
  })
  return () => { unlisten.then(fn => fn()) }
}, [])
```

**3. Command Batching**:
```rust
#[tauri::command]
async fn create_file_with_schema(
    request: CreateFileRequest,
    state: State<'_, AppState>,
) -> Result<FileWithSchema, String> {
    // Rust fetches schema, creates file, populates frontmatter
    // Returns everything frontend needs in ONE call
    let schema = parse_collection_schema(&request.collection_name)?;
    let file = create_file_with_frontmatter(&schema, request.initial_frontmatter)?;
    Ok(FileWithSchema { file, schema })
}
```

#### Anti-Patterns to Avoid

❌ **Don't Use Tauri Events for Frontend State Coordination**:
```typescript
// BAD: Crossing boundaries inappropriately
emit('request-collections-data')
listen('collections-data-response', ...) // Frontend-to-frontend via native layer
```

❌ **Don't Store Query Data in Rust State**:
```rust
// BAD: Duplicating frontend cache
pub struct AppState {
    pub collections_cache: Mutex<Vec<Collection>>, // Don't do this
}
```

❌ **Don't Poll Tauri Commands**:
```typescript
// BAD: Polling across IPC
while (true) {
  const exists = await invoke('file_exists', { path })
  if (exists) break
}

// GOOD: Use Tauri events
await listen('file-created', ...)
```

#### Production Architecture Recommendation

```
┌─────────────────────────────────────────────────────┐
│ React Component Layer                               │
│  - Renders UI                                       │
│  - Registers query getters via queryBridge          │
│  - Listens to Tauri events for native changes      │
└─────────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────────┐
│ State Management Layer                              │
│                                                     │
│  ┌─────────────────┐      ┌────────────────────┐  │
│  │ TanStack Query  │      │ Zustand Stores     │  │
│  │ - Server state  │←────→│ - Client state     │  │
│  │ - Caching       │bridge│ - UI state         │  │
│  └─────────────────┘      └────────────────────┘  │
│                                      │              │
└──────────────────────────────────────┼──────────────┘
                                       ↓
┌─────────────────────────────────────────────────────┐
│ Tauri IPC Layer                                     │
│  - invoke() for commands                            │
│  - listen() for events                              │
└─────────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────────┐
│ Rust Backend                                        │
│  - File operations                                  │
│  - Schema parsing                                   │
│  - File watching (emit events)                      │
│  - Business logic                                   │
└─────────────────────────────────────────────────────┘
```

**Verdict**: "This pattern is what I'd build for a commercial Tauri application."

## Industry Research: 2025 State Management Patterns

### Dominant Pattern: Separation of Concerns

**Modern React Applications (2025)**:
- **TanStack Query** owns server half: fetched data, caching, re-validation
- **Zustand** owns client half: UI state, preferences, local logic
- This gives "90% of Redux's superpowers at a fraction of the code, bundle size, and cognitive load"

### Best Practices from Industry

1. **Use TanStack Query for server data**: Server data rendered in UI using TanStack Query hooks
2. **Use Zustand for client state**: User input and UI state stored in Zustand
3. **Connect via query keys**: Input from Zustand becomes query parameters
4. **Avoid mixing concerns**: Don't put server state in Zustand or UI state in queries

### Tauri-Specific Patterns

**Frontend State Management**:
- Popular: Recoil (data-flow graph) and Zustand (simplified flux with hooks)
- Zustand preferred for "small, fast, and scalable" nature
- Perfect for managing state within a frontend window in Tauri

**Backend State Management**:
- Use Rust concurrency primitives (`Arc`, `Mutex`) for shared state
- Initialize with `manage()` function in Tauri Builder
- Keep backend state separate from frontend cache

**Integration**:
- Commands invoked via `useEffect` when app loads
- Proper error handling in both frontend and backend
- TypeScript for type safety across IPC boundary

## Deep Dive: Comparing the Two Approaches

### Philosophical Differences

**Hybrid Action Hooks** (React philosophy):
- **Business logic location**: Split between hooks (orchestration) and stores (state)
- **Coupling**: Loose - hooks import from stores/queries independently
- **Testing approach**: Test hooks and stores separately, integration tests for wiring
- **Mental model**: "Actions are just functions that coordinate state"

**Callback Registry** (Tauri philosophy):
- **Business logic location**: Centralized in stores
- **Coupling**: Moderate - stores depend on bridge abstraction
- **Testing approach**: Test stores with mocked bridge, test bridge separately
- **Mental model**: "Stores are self-contained with external data adapters"

### Technical Comparison Matrix

| Aspect | Hybrid Action Hooks | Callback Registry |
|--------|---------------------|-------------------|
| **Type Safety** | ✅ Full (automatic inference) | ✅ Full (requires generic types) |
| **Performance** | ✅ Sync access, stable callbacks | ✅ Sync access, O(1) lookup |
| **Bundle Size** | ✅ No new abstractions | ⚠️ +1 bridge module (~2KB) |
| **Complexity** | ✅ Low (standard hooks) | ⚠️ Medium (new concept) |
| **Debuggability** | ✅ Stack traces through hooks | ✅ Stack traces through bridge |
| **Testing** | ✅ Standard React Testing Library | ⚠️ Need bridge mocking utilities |
| **Maintainability** | ✅ Familiar patterns | ⚠️ Custom pattern to document |
| **Multi-window** | ⚠️ Need context per window | ✅ Natural isolation per window |
| **IPC Optimization** | ⚠️ Logic split across layers | ✅ All context in one place |
| **React Idioms** | ✅ 100% idiomatic | ⚠️ Slightly unconventional |
| **Tauri Patterns** | ⚠️ Frontend-heavy | ✅ Clear boundaries |

### Implementation Complexity

**Hybrid Action Hooks**:
```typescript
// 3 locations to update
// 1. Create hook
export function useEditorActions() {
  const queryClient = useQueryClient()
  const saveFile = useCallback(async () => {
    const store = useEditorStore.getState()
    const query = queryClient.getQueryData(...)
    // ... logic
  }, [queryClient])
  return { saveFile }
}

// 2. Update store
setAutoSaveCallback: (cb) => set({ autoSaveCallback: cb })

// 3. Wire in Layout
useEffect(() => {
  useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
}, [saveFile])
```

**Callback Registry**:
```typescript
// 3 locations to update
// 1. Create bridge (one-time setup)
export const queryBridge = new QueryBridge()

// 2. Update store
createFile: async () => {
  const collections = queryBridge.get<Collection[]>('collections')
  // ... logic
}

// 3. Register in Layout
useEffect(() => {
  queryBridge.register('collections', () => queryClient.getQueryData(...))
  return () => queryBridge.unregister('collections')
}, [])
```

**Complexity Winner**: Tie - both require similar amounts of wiring, just in different places.

### Scaling Considerations

**Hundreds of Files**:
- Both: ✅ TanStack Query handles caching efficiently, O(1) lookups
- Both: ✅ No additional overhead

**Dozens of Actions**:
- Hybrid: Each action is a hook function (standard pattern to scale)
- Registry: Each action calls `queryBridge.get()` (single line per query)
- **Winner**: Tie - both scale linearly

**Multiple Windows**:
- Hybrid: Need context provider per window, hooks tied to QueryClient
- Registry: Natural isolation - each window registers its own bridge
- **Winner**: Registry (simpler multi-window story)

**Team Growth**:
- Hybrid: New devs understand hooks immediately (standard React)
- Registry: Need to document bridge pattern (custom abstraction)
- **Winner**: Hybrid (lower onboarding friction)

## Decision Framework

### Choose Hybrid Action Hooks If:

✅ Team is React-heavy (not deep Tauri/Rust experience)
✅ Codebase already uses custom hooks extensively
✅ No plans for multi-window architecture
✅ Prefer standard patterns over custom abstractions
✅ Want lowest learning curve for new developers
✅ Value React ecosystem alignment

**Best For**: React-first teams, rapid iteration, standard architectures

### Choose Callback Registry If:

✅ Planning multi-window architecture
✅ Want all business logic centralized in stores
✅ Team has strong Tauri/Rust expertise
✅ Prefer clear architectural boundaries
✅ Need optimal IPC performance (batching opportunities)
✅ Building complex desktop application (not web-like SPA)

**Best For**: Tauri-first teams, complex desktop apps, multi-window UIs

### For This Codebase Specifically

**Context**:
- React 19 + TypeScript-heavy codebase
- Custom hooks already extensively used (`useEditorActions` pattern exists)
- Single-window application (no multi-window plans)
- Architecture guide already documents hooks pattern
- Team comfortable with React patterns

**Alignment Score**:
- **Hybrid Action Hooks**: 9/10 (fits existing patterns perfectly)
- **Callback Registry**: 7/10 (technically excellent but adds new concept)

## Final Recommendations

### Primary Recommendation: Hybrid Action Hooks

**Reasoning**:
1. **Existing Patterns**: Codebase already uses custom hooks (e.g., `useCreateFile`, `useFileActions`)
2. **Team Familiarity**: React-heavy team, hooks are well-understood
3. **Architecture Guide**: Already documents hooks for "reusable UI logic"
4. **Simplicity**: No new abstractions to learn or maintain
5. **React 19 Alignment**: Natural fit with modern React patterns
6. **Low Risk**: Incremental migration from existing code structure

**When Callback Registry Might Be Better**:
- If you expand to multi-window architecture (preview window, settings window)
- If you move more business logic to Rust (reducing frontend orchestration)
- If team grows with Tauri experts who prefer clear boundary patterns

### Implementation Strategy

**Phase 1: Extract `saveFile` to Hook** (2-3 hours)
1. Create `src/hooks/editor/useEditorActions.ts`
2. Implement `saveFile` with direct `queryClient.getQueryData()` access
3. Update `editorStore` to accept auto-save callback
4. Wire in Layout component
5. Update all call sites (keyboard shortcuts, buttons, menus)
6. Remove event bridge code for schema-field-order

**Phase 2: Validate Pattern** (1 hour)
1. Comprehensive testing (unit, integration, E2E)
2. Performance profiling (verify no regressions)
3. Team review (ensure pattern is understood)

**Phase 3: Apply to Remaining Actions** (1-2 hours each)
1. `createNewFile` → Move to `useFileActions` hook
2. `deleteFile` → Move to `useFileActions` hook
3. Other orchestration actions
4. Keep pure state mutations in stores

**Phase 4: Clean Up** (1-2 hours)
1. Remove all event bridge infrastructure
2. Update `architecture-guide.md` with Hybrid Action Hooks pattern
3. Add testing utilities for hook/store integration
4. Document when to use hooks vs stores

**Total Effort**: ~1 day
**Risk**: Low (incremental, well-understood pattern)

### Quality Gates

Before considering migration complete:

- [ ] No polling loops anywhere in codebase
- [ ] Full TypeScript type safety (no `any` in action flows)
- [ ] Single-file traceability for each user action
- [ ] All tests passing (unit + integration + E2E)
- [ ] No performance regressions (profile with React DevTools)
- [ ] Concurrent save guard prevents race conditions
- [ ] Architecture guide updated with new pattern
- [ ] Team training complete (demo + Q&A session)

### Alternative Path: Hybrid Approach

If you want benefits of both patterns:

**Short-term**: Implement Hybrid Action Hooks (solves immediate problems, low risk)

**Long-term evaluation points**:
- At multi-window implementation → Consider adding Callback Registry
- At 50+ orchestration actions → Consider centralizing in stores with bridge
- At team growth with Tauri experts → Re-evaluate boundary patterns

**Migration Path**: Can move from Hybrid Action Hooks → Callback Registry later if needed. Registry can wrap existing hooks initially.

## Conclusion

Both patterns are technically excellent and eliminate all issues with the current event bridge. The choice is **architectural philosophy**, not technical capability:

- **Hybrid Action Hooks**: React-first, hooks for orchestration, stores for state
- **Callback Registry**: Tauri-first, stores for everything, bridge for data access

**For Astro Editor**: **Hybrid Action Hooks is the right choice** based on existing codebase patterns, team composition, and React-heavy architecture. The pattern:
- Eliminates polling, race conditions, and type safety issues
- Follows existing React patterns team understands
- Requires no new abstractions
- Has clear migration path
- Scales to hundreds of files without issues

**Priority**: Post-1.0.0 architectural improvement. Current event bridge works (no user-facing bugs), but this refactor provides significant developer experience and maintainability benefits.

---

**Research Methodology Note**: This analysis incorporated expert consultation from React performance and Tauri v2 specialists, industry research on 2025 state management patterns, and first-principles analysis of the architectural trade-offs. Both recommended patterns are production-ready and technically sound - the recommendation is based on fit with this specific codebase context.
