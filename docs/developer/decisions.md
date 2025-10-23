# Architectural Decisions Log

This document records key architectural decisions, the reasoning behind technology choices, and the context that led to current patterns.

## Table of Contents

- [Technology Choices](#technology-choices)
- [State Management Decisions](#state-management-decisions)
- [Component Architecture](#component-architecture)
- [Performance Decisions](#performance-decisions)
- [Developer Experience](#developer-experience)

## Technology Choices

### Why Tauri over Electron?

**Decision**: Use Tauri v2 for the desktop application framework.

**Alternatives Considered**:
- Electron
- NW.js
- Native Swift/Cocoa

**Reasoning**:

1. **Bundle Size**: Tauri apps are ~10-20MB vs Electron's ~100-200MB
   - Ships without bundled Chromium (uses system WebView)
   - Only includes necessary Rust dependencies

2. **Performance**:
   - Lower memory footprint (system WebView vs bundled Chromium)
   - Rust backend is faster than Node.js for file operations
   - Better startup times

3. **Native Feel**:
   - Uses native system WebView (WebKit on macOS)
   - Better OS integration (menus, dialogs, etc.)
   - Follows macOS design patterns naturally

4. **Security**:
   - Rust's memory safety prevents entire classes of bugs
   - Smaller attack surface (no Node.js runtime)
   - Fine-grained permissions model

5. **Developer Experience**:
   - Modern Rust tooling
   - Type-safe IPC between Rust and TypeScript
   - Active development and growing ecosystem

**Trade-offs Accepted**:
- Smaller plugin ecosystem than Electron
- Less mature (but Tauri v2 is production-ready)
- Requires Rust knowledge for backend work

**Context**: For a focused markdown editor targeting macOS initially, the smaller bundle size, native feel, and performance benefits outweigh ecosystem size.

---

### Why CodeMirror 6 over Monaco/Alternatives?

**Decision**: Use CodeMirror 6 (vanilla, not react-codemirror) for the editor.

**Alternatives Considered**:
- Monaco Editor (VS Code's editor)
- Tiptap (ProseMirror-based)
- Lexical (Meta's editor)
- react-codemirror wrapper

**Reasoning**:

1. **Markdown-First Design**:
   - CodeMirror 6 has excellent markdown support
   - Monaco is optimized for code, not prose
   - Better handling of soft wrap and long paragraphs

2. **Lightweight**:
   - ~200KB vs Monaco's ~2MB
   - Faster load times and lower memory usage
   - Important for desktop app startup performance

3. **Extensibility**:
   - Clean extension API for custom syntax highlighting
   - Easy to add custom decorations (URL clicking, drag-drop)
   - Better control over behavior than Monaco

4. **Mobile Support** (Future):
   - Works well on mobile browsers
   - Monaco has poor mobile support

5. **Direct Control**:
   - Using vanilla CodeMirror (not react-codemirror) gives us complete control
   - Custom state management integration
   - Direct access to transactions and effects
   - No wrapper abstractions to work around

**Trade-offs Accepted**:
- Manual React integration (vs react-codemirror convenience)
- Smaller community than Monaco
- More custom code for features Monaco provides out-of-box

**Context**: For a markdown-focused editor where we need custom behaviors (iA Writer-style syntax highlighting, URL clicking, etc.), CodeMirror's flexibility and markdown support are critical.

---

### Why React 19 over Vue/Svelte/Solid?

**Decision**: Use React 19 with TypeScript for the frontend.

**Alternatives Considered**:
- Vue 3
- Svelte
- SolidJS

**Reasoning**:

1. **Ecosystem**:
   - Largest component library ecosystem
   - Best Tauri integration examples
   - Most AI coding assistants trained on React

2. **ShadCN/UI**:
   - We wanted to use ShadCN components
   - React-first library
   - Perfect for desktop app aesthetics

3. **Developer Familiarity**:
   - Team expertise in React
   - Faster development velocity

4. **TypeScript Integration**:
   - Excellent TypeScript support
   - Strong typing for component props
   - Better IDE support

**Trade-offs Accepted**:
- Larger bundle size than Svelte/SolidJS
- More verbose than Vue
- Requires careful performance optimization (memoization, etc.)

**Context**: React's ecosystem, combined with ShadCN/UI for macOS-native aesthetics, outweighs the bundle size concerns for a desktop application.

---

## State Management Decisions

### Why Zustand + TanStack Query over Redux/MobX/Context?

**Decision**: Use Zustand for client state and TanStack Query for server state.

**Alternatives Considered**:
- Redux Toolkit
- MobX
- Jotai
- React Context + useReducer
- All-in-one solutions (Redux + RTK Query)

**Reasoning**:

**For Zustand**:

1. **Simplicity**:
   - Minimal boilerplate
   - No providers needed
   - Direct store access with `getState()`

2. **Performance**:
   - Automatic selector-based subscriptions
   - Fine-grained re-render control
   - `getState()` pattern prevents render cascades

3. **TypeScript**:
   - Excellent type inference
   - No action types to maintain
   - Type-safe store updates

4. **Size**:
   - Tiny bundle (~1KB)
   - No middleware required

**For TanStack Query**:

1. **Server State Specialization**:
   - Built for async data (file system operations)
   - Automatic caching and invalidation
   - Background refetching
   - Loading/error states

2. **DevTools**:
   - Excellent debugging tools
   - Query inspection
   - Cache visualization

3. **Patterns**:
   - Centralized query keys
   - Mutation hooks
   - Optimistic updates

**Why Not Redux**:
- Too much boilerplate for our use case
- Overkill for a single-window desktop app
- Zustand provides similar benefits with less code

**Why Not MobX**:
- More magic/implicit behavior
- Harder to debug render cascades
- Less clear data flow

**Why Not Context**:
- Performance issues with frequent updates
- No built-in devtools
- Manual optimization required

**Trade-offs Accepted**:
- Need to manage two state libraries
- Learning curve for TanStack Query patterns
- Need to coordinate invalidation between Zustand and TanStack Query

**Context**: The hybrid approach gives us the best of both worlds: simple client state management with Zustand and robust server state handling with TanStack Query.

---

### Why Decomposed Stores (Editor/Project/UI)?

**Decision**: Split Zustand state into three focused stores instead of one monolithic store.

**Alternatives Considered**:
- Single unified store
- More granular stores (one per feature)
- Store per page/route

**Reasoning**:

1. **Performance**:
   - Components only subscribe to relevant state
   - Editing content doesn't re-render sidebar
   - Project changes don't re-render editor

2. **Clarity**:
   - Each store has single responsibility
   - Clear ownership of state
   - Easier to reason about data flow

3. **Testability**:
   - Each store can be tested independently
   - Smaller surface area per test
   - Mock only what you need

4. **Maintainability**:
   - Changes isolated to relevant store
   - Easier to add new features
   - Clearer boundaries

**Trade-offs Accepted**:
- Need to coordinate between stores sometimes
- Slight complexity in imports (three stores vs one)
- Need to remember which state lives where

**Context**: The volatility difference between editor state (every keystroke), project state (rarely), and UI state (occasional) makes separation critical for performance.

---

## Component Architecture

### Why Direct Store Pattern over React Hook Form?

**Decision**: Components access Zustand store directly instead of using React Hook Form.

**Alternatives Considered**:
- React Hook Form
- Formik
- Plain controlled components with local state

**Reasoning**:

1. **Infinite Loop Issues**:
   - React Hook Form + Zustand = infinite re-render loops
   - Hook Form watches for changes, Zustand updates trigger more watches
   - Spent days debugging before abandoning

2. **Simplicity**:
   - Direct pattern is simpler to understand
   - Fewer abstractions
   - Clear data flow

3. **Real-time Sync**:
   - Auto-save needs immediate Zustand updates
   - Hook Form's controlled approach adds latency
   - Direct access gives instant feedback

4. **Performance**:
   - Fewer intermediary re-renders
   - Direct store updates are fast
   - No form state reconciliation needed

**Trade-offs Accepted**:
- Manual validation (no built-in form validation)
- More boilerplate per field
- No built-in form state management

**Context**: For a real-time editing app with auto-save, the infinite loop issues and sync requirements make React Hook Form unsuitable.

See [form-patterns.md](./form-patterns.md) for implementation details.

---

### Why Vanilla CodeMirror over react-codemirror?

**Decision**: Use vanilla CodeMirror 6 API directly instead of react-codemirror wrapper.

**Alternatives Considered**:
- @uiw/react-codemirror
- react-codemirror (official package)
- Other React wrappers

**Reasoning**:

1. **Complete Control**:
   - Direct access to EditorView and EditorState
   - Custom transaction handling
   - Fine-grained update control

2. **Performance**:
   - Avoid React wrapper overhead
   - Direct state updates without React reconciliation
   - Better control over re-renders

3. **Custom Behaviors**:
   - iA Writer-style syntax highlighting requires custom extensions
   - URL clicking, drag-drop need direct decoration access
   - Custom keymaps and commands

4. **State Integration**:
   - Direct Zustand integration
   - Avoid wrapper's state synchronization
   - More predictable behavior

**Trade-offs Accepted**:
- Manual React integration (useEffect for setup/teardown)
- Need to manage EditorView lifecycle ourselves
- More code than using a wrapper

**Context**: The custom features we need (iA Writer highlighting, advanced interactions) require direct API access that wrappers abstract away.

---

## Performance Decisions

### Why the getState() Pattern?

**Decision**: Use `useStore.getState()` in callbacks instead of subscribing to store values.

**Alternatives Considered**:
- Subscribe to all values needed in callbacks
- Pass values as callback parameters
- Use refs to hold latest values

**Reasoning**:

1. **Prevents Render Cascades**:
   - Subscriptions trigger re-renders
   - Re-renders recreate callbacks
   - New callbacks trigger their dependents
   - `getState()` breaks this chain

2. **Stable Dependencies**:
   - Callbacks with `[]` deps never recreate
   - useEffect runs only once
   - No dependency tracking needed

3. **Current Values**:
   - Always gets latest state
   - No stale closure issues
   - Works in async operations

**Trade-offs Accepted**:
- Less explicit data flow
- Need to understand pattern
- Can't see subscriptions from code inspection

**Context**: Critical for preventing performance issues in editor. One keystroke shouldn't trigger 10+ component re-renders.

See [performance-guide.md](./performance-guide.md) for detailed patterns.

---

### Why CSS Visibility over Conditional Rendering?

**Decision**: Use CSS (`hidden`, `opacity-0`) instead of conditional rendering for togglable panels.

**Alternatives Considered**:
- Conditional rendering (`{visible && <Component />}`)
- CSS `display: none`
- Unmount and remount on toggle

**Reasoning**:

1. **Preserve State**:
   - Keeps ResizablePanel sizes
   - Maintains scroll positions
   - Preserves internal component state

2. **Avoid Re-initialization**:
   - No re-mounting cost
   - No re-fetching data
   - Instant show/hide

3. **Smooth Transitions**:
   - Can animate opacity
   - Smooth width transitions
   - Better UX

**Trade-offs Accepted**:
- Slightly higher memory usage (components stay mounted)
- Need to be careful with CSS selectors
- Invisible elements still in DOM

**Context**: For panels that users toggle frequently (sidebar, frontmatter), preserving state is more important than minimal memory usage.

---

## Developer Experience

### Why Strict TypeScript?

**Decision**: Use `"strict": true` in tsconfig.json.

**Reasoning**:

1. **Catch Bugs Early**:
   - Null/undefined checks at compile time
   - Prevents runtime errors
   - Better code quality

2. **Better AI Assistance**:
   - AI coding assistants work better with types
   - More accurate suggestions
   - Fewer hallucinations

3. **Refactoring Confidence**:
   - TypeScript errors guide refactoring
   - Breaking changes are caught immediately
   - Safer large-scale changes

4. **Documentation**:
   - Types serve as inline documentation
   - Easier onboarding
   - Self-documenting code

**Trade-offs Accepted**:
- More upfront work to type everything
- Occasional fights with type system
- Longer compile times

**Context**: For a complex application with multiple state systems and async operations, type safety prevents entire classes of bugs.

---

### Why Vitest over Jest?

**Decision**: Use Vitest for testing.

**Alternatives Considered**:
- Jest
- Testing Library alone

**Reasoning**:

1. **Vite Integration**:
   - Same config as build
   - Faster test execution
   - No additional setup

2. **Speed**:
   - Faster than Jest
   - Better watch mode
   - Parallel execution

3. **Modern API**:
   - Compatible with Jest tests
   - Better TypeScript support
   - ESM native

**Trade-offs Accepted**:
- Smaller ecosystem than Jest
- Fewer plugins
- Less Stack Overflow answers

**Context**: Since we use Vite for building, Vitest provides seamless integration and better performance.

---

### Why react-hotkeys-hook over Manual Event Handling?

**Decision**: Use react-hotkeys-hook for keyboard shortcuts.

**Alternatives Considered**:
- Manual addEventListener
- mousetrap
- hotkeys-js
- Custom hook

**Reasoning**:

1. **Cross-Platform**:
   - `mod` key works on all platforms
   - Handles Cmd vs Ctrl automatically
   - Consistent behavior

2. **React Integration**:
   - Automatic cleanup
   - Lifecycle management
   - Hook-based API

3. **Declarative**:
   - Define shortcuts where used
   - Clear intent
   - Easy to see what shortcuts exist

**Trade-offs Accepted**:
- Additional dependency
- Learning library API
- Less control than manual

**Context**: Keyboard shortcuts are critical for editor UX. Using a library ensures cross-platform consistency and reduces bugs.

See [keyboard-shortcuts.md](./keyboard-shortcuts.md) for implementation details.

---

## Future Extensibility

### Plugin System Considerations

While not implemented yet, the architecture is designed to support future plugins:

1. **Command Registry**: New commands can be registered from plugins
2. **CodeMirror Extensions**: Plugins can add editor features
3. **Module Structure**: Clear boundaries for plugin integration
4. **Event System**: Plugins can listen to app events

### Planned Extension Points

1. **Theme System**: Custom editor themes via CodeMirror extensions
2. **Language Support**: Beyond markdown via language plugins
3. **AI Integration**: Via command registry and custom extensions
4. **Export Formats**: Via new modules following existing patterns
5. **Cloud Sync**: Via store middleware and TanStack Query integration

---

**Note**: This document should be updated whenever significant architectural decisions are made. Include the context, alternatives considered, reasoning, and trade-offs for future reference.
