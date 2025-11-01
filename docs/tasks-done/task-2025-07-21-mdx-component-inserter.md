# PRD: MDX Component Inserter

This document outlines the technical approach for implementing a feature that allows users to quickly insert Astro components into MDX files.

## 1. Feature Overview

The user interface for this should be simple. When editing an MDX file, typing a forward slash (`/`) when not inside a URL or HTML tag should open a quick insert menu under the cursor. This menu should list all available MDX components and be fuzzy-searchable. Choosing a component and pressing Enter should insert the correct component structure with its required props.

**Example:** Typing `/call` might suggest `<Callout />`. Selecting it would insert `<Callout type="warning"></Callout>`.

## 2. Recommended Architecture

This feature should be implemented as a two-part system: a **robust backend parser** in Rust and a **smart frontend integration** using CodeMirror's extension system. This provides a clean separation of concerns and uses the best tool for each job.

---

### **Part 1: The Backend - Reliably Parsing Astro Components** ✅ DONE

The most critical part of this feature is reliably extracting the necessary information from the `.astro` component files. Using regular expressions for this is brittle and should be avoided. The correct approach is to use an Abstract Syntax Tree (AST) parser.

#### 2.1. Implementation Plan (Rust)

1.  **Create a New Tauri Command:**
    Define a new command in `src-tauri/src/main.rs`:

    ```rust
    #[tauri::command]
    fn scan_mdx_components(project_path: String) -> Result<Vec<MdxComponent>, String> {
        // ... implementation ...
    }
    ```

2.  **Define the Data Structure:**
    Create a Rust struct that will be serialized and sent to the frontend. This should live in a new `src-tauri/src/models/mdx_component.rs` file.

    ```rust
    // src-tauri/src/models/mdx_component.rs
    use serde::Serialize;

    #[derive(Serialize, Clone, Debug)]
    pub struct PropInfo {
        name: String,
        prop_type: String, // e.g., "'warning' | 'info'", "string", "boolean"
        is_optional: bool,
    }

    #[derive(Serialize, Clone, Debug)]
    pub struct MdxComponent {
        name: String,       // e.g., "Callout"
        props: Vec<PropInfo>,
        has_slot: bool,
    }
    ```

3.  **Implement the Parser Logic:**
    The command will scan the `[project_path]/src/components/mdx/` directory for `.astro` files. For each file, it will perform the following steps:

    a. **Read the File:** Read the file content into a string.
    b. **Isolate the Frontmatter:** Extract the TypeScript code between the `---` fences.
    c. **Parse with `swc`:** Use the `swc_ecma_parser` crate to parse the extracted script into a TypeScript AST.
    d. **Traverse the AST:** Walk the AST to find an `export interface Props` declaration.
    e. **Extract Prop Info:** Iterate through the `Props` interface members to extract the name, type annotation (as a string), and whether it's optional (by checking for the `?` token).
    f. **Check for `<slot />`:** In the HTML part of the file (outside the `---` fences), perform a simple and efficient string search for the substring `<slot />`. An AST for the HTML is overkill; a string `contains` check is sufficient and performant.
    g. **Construct and Return:** Assemble the extracted information into the `MdxComponent` struct and add it to the vector that will be returned to the frontend.

---

### **Part 2: The Frontend - The Component Builder Dialog** ✅ DONE

The frontend is responsible for providing a user-friendly interface to select, configure, and insert MDX components.

After initial consideration, an approach using CodeMirror's built-in `autocompletion` functionality was deemed insufficient for the desired user experience. While functional for simple text insertion, it would be complex to style and ill-suited for the multi-step configuration process (selecting a component, then toggling its props).

Therefore, the chosen architecture is a **dedicated modal dialog**, which we will call the **Component Builder**. This approach decouples the insertion logic from the editor's direct input handling, allowing us to use our existing `shadcn/ui` and `Tailwind` infrastructure to build a rich, fully-interactive, and visually consistent UI.

#### 2.2. Architecture Updates (Based on Current Implementation)

Since this plan was written, we have integrated:

- **TanStack Query v5** for server state management
- **react-hotkeys-hook** for keyboard shortcuts
- **Command palette pattern** already established

The updated approach will:

1. Use TanStack Query for fetching MDX components (not Zustand store for this data)
2. Use Zustand only for dialog UI state (isOpen, step, selectedComponent, enabledProps)
3. Follow the existing CommandDialog pattern from CommandPalette
4. Use react-hotkeys-hook for the Cmd+/ shortcut

### 3. Data Flow and User Experience

The revised data flow is centered around the Component Builder dialog:

1.  **Project Load:** A TanStack Query hook (`useMdxComponentsQuery`) calls the `scan_mdx_components` Tauri command. Rust parses all relevant `.astro` files and returns a structured list of component data.
2.  **Cache Component Data:** TanStack Query caches the component data, making it available throughout the app.
3.  **Trigger:** The user, while focused on the editor, presses the keyboard shortcut (`Cmd+/`).
4.  **Launch Dialog:** The shortcut (using react-hotkeys-hook) opens the `ComponentBuilderDialog` with access to the current editor view.
5.  **Select Component:** The user is presented with a searchable list of available components (e.g., `Callout`, `Figure`). They select one.
6.  **Configure Props:** The dialog transitions to a new view where the user can see all the props for the selected component. They can toggle optional props on or off using switches.
7.  **Build & Insert Snippet:** Upon confirming, a utility function generates a CodeMirror-compatible snippet string with placeholders (e.g., `<Callout title="\${1}">\${2}</Callout>`).
8.  **Dispatch to Editor:** A CodeMirror command is dispatched, inserting the snippet at the user's cursor position and activating snippet-mode, allowing the user to `Tab` between the placeholders.

---

## 4. Implementation Plan: The MDX Component Builder Dialog

### 4.1. File & Component Architecture

To ensure a clean separation of concerns, the feature will be composed of the following new files:

- `src/hooks/queries/useMdxComponentsQuery.ts`: TanStack Query hook to fetch MDX components.
- `src/store/componentBuilderStore.ts`: A Zustand store to manage only the dialog UI state.
- `src/components/ComponentBuilder/index.ts`: Barrel export file.
- `src/components/ComponentBuilder/ComponentBuilderDialog.tsx`: The main React component for the dialog UI.
- `src/lib/editor/snippet-builder.ts`: A pure utility file for generating the final CodeMirror snippet string.
- `src/lib/editor/commands/insertSnippet.ts`: A new command to insert snippets in the editor.

### 4.2. State Management (`useComponentBuilderStore`)

The Zustand store is the brain of the operation.

**File:** `src/store/componentBuilderStore.ts`

```typescript
import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { MdxComponent } from '@/types/common' // Adjust path as needed
import { buildSnippet } from '@/lib/editor/snippet-builder'
import { insertSnippet } from '@/lib/editor/commands'

// Define State and Actions
interface ComponentBuilderState {
  isOpen: boolean
  step: 'list' | 'configure'
  selectedComponent: MdxComponent | null
  enabledProps: Set<string>
  editorView: EditorView | null
}

interface ComponentBuilderActions {
  open: (view: EditorView) => void
  close: () => void
  selectComponent: (component: MdxComponent) => void
  toggleProp: (propName: string) => void
  insert: () => void
  back: () => void
}

const initialState: ComponentBuilderState = {
  isOpen: false,
  step: 'list',
  selectedComponent: null,
  enabledProps: new Set(),
  editorView: null,
}

// Create Store
export const useComponentBuilderStore = create<
  ComponentBuilderState & ComponentBuilderActions
>((set, get) => ({
  ...initialState,

  open: editorView => set({ isOpen: true, editorView }),

  close: () => set({ ...initialState }), // Fully reset on close

  selectComponent: component => {
    const requiredProps = new Set(
      component.props.filter(p => !p.is_optional).map(p => p.name)
    )
    set({
      selectedComponent: component,
      step: 'configure',
      enabledProps: requiredProps,
    })
  },

  toggleProp: propName => {
    set(state => {
      const newEnabledProps = new Set(state.enabledProps)
      if (newEnabledProps.has(propName)) {
        newEnabledProps.delete(propName)
      } else {
        newEnabledProps.add(propName)
      }
      return { enabledProps: newEnabledProps }
    })
  },

  insert: () => {
    const { selectedComponent, enabledProps, editorView } = get()
    if (!selectedComponent || !editorView) return

    const snippetString = buildSnippet(selectedComponent, enabledProps)
    insertSnippet(editorView, snippetString)
    get().close() // Close and reset after insertion
  },

  back: () =>
    set({ step: 'list', selectedComponent: null, enabledProps: new Set() }),
}))
```

### 4.3. UI Implementation (`ComponentBuilderDialog.tsx`)

This component orchestrates the entire UI using `shadcn/ui`.

**File:** `src/components/ComponentBuilder/ComponentBuilderDialog.tsx`

**Key Implementation Points:**

1.  **Global Shortcut:** In `src/components/Layout/Layout.tsx`, add the new hotkey following the existing pattern.

    ```tsx
    useHotkeys(
      'mod+/',
      () => {
        // Cmd+/: Open MDX Component Builder
        if (currentFile?.path.endsWith('.mdx')) {
          useComponentBuilderStore.getState().open(editorView)
        }
      },
      { preventDefault: true }
    )
    ```

2.  **Dialog Structure:**
    - Use `CommandDialog` from `shadcn/ui`. Its `open` and `onOpenChange` props will be bound to `store.isOpen` and `store.close`.
    - A conditional render based on `store.step` will show either the component list or the props configurator.

3.  **Component List (`step === 'list'`):**
    - Render `Command.Input`, `Command.List`, etc.
    - Map over components from `useMdxComponentsQuery` to create `Command.Item` elements.
    - `onSelect` for each item should call `store.selectComponent(component)`.

4.  **Props Configurator (`step === 'configure'`):**
    - This view takes over the dialog content when `step` changes.
    - **Layout:** Use a `Card` component for structure.
    - **Header:** `CardHeader` should contain the `Card.Title` (e.g., "Configure `<Callout />`") and a `Button` (variant="ghost") for "Back", which calls `store.back()`.
    - **Content:** `CardContent` will map over `store.selectedComponent.props`. Each prop is rendered in a `div` with `flex items-center justify-between`.
      - `Label`: Displays the prop name. Link it to the Switch using `htmlFor`.
      - `Switch`:
        - `id`: The prop name.
        - `checked`: `store.enabledProps.has(prop.name)`.
        - `onCheckedChange`: `() => store.toggleProp(prop.name)`.
        - `disabled`: `!prop.is_optional`. This provides a clear visual cue for required props.
    - **Footer:** `CardFooter` contains a `Button` that reads "Insert Component" and calls `store.insert()`. The entire form should be wrappable in a `<form>` tag whose `onSubmit` also calls `store.insert()` to allow `Enter` key submission.

### 4.4. Snippet Logic & Editor Command

This part connects the UI to the CodeMirror editor.

1.  **Snippet Builder (`snippet-builder.ts`):**
    - Create a pure function to maximize testability and separation of concerns.

    **File:** `src/lib/editor/snippet-builder.ts`

    ```typescript
    import { MdxComponent } from '@/types/common'

    export function buildSnippet(
      component: MdxComponent,
      enabledProps: Set<string>
    ): string {
      let propIndex = 1
      const propsString = component.props
        .filter(p => enabledProps.has(p.name))
        .map(p => `${p.name}="\${${propIndex++}}"`)
        .join(' ')

      if (component.has_slot) {
        return `<${component.name} ${propsString}>\${${propIndex}}</${component.name}>`
      }
      return `<${component.name} ${propsString} />`
    }
    ```

2.  **Editor Command (`commands.ts`):**
    - This function will execute the CodeMirror transaction. Note the corrected import path for `snippet`.

    **File:** `src/lib/editor/commands.ts`

    ```typescript
    import { snippet } from '@codemirror/autocomplete'
    import { EditorView } from '@codemirror/view'

    export function insertSnippet(view: EditorView, template: string) {
      if (!view) return
      // The snippet function returns a command that can be dispatched
      const snippetCommand = snippet(template)
      snippetCommand(view) // Execute the command
      view.focus()
    }
    ```

This refined plan provides a clear, step-by-step guide that is technically accurate and architecturally sound, making it much easier to implement correctly.

## Bugs and Cleanup Tasks

- [x] Cmd + / should only work in MDX files
- [x] Restyle second menu (props picker)

### Get Snipped Insertion Working

There is a simple reference implementation in the `DebugScreen.tsx` which works perfectly and is very simple. All the logic for the entire editor is within that file. Subtasks:

- [x] Refactor Codemirror (without affecting functionality) to stop using basicSetup and replace it with only the nececarry extensions
- [x] Simplify any other code in `src/lib/editor` and `src/hooks/editor` and `EditorView.tsx` so it is as simple as possible and easy to reason about and read. Remove any unnececarry code related to Failed attempts at snippet insertion and tag completion.
- [x] Actially implement the snippet insertion from the `/src/components/ComponentBuilder/ComponentBuilderDialog.tsx` system pallete, based on the pattern in the DebugScreen.
- [x] Double-check the code for anything else which can be simplified or removed once this is working.

You are to go through these step-by-step.
