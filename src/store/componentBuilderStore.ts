import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import { commands, type Collection, type ImportPlan } from '@/types'
import { MdxComponent } from '../hooks/queries/useMdxComponentsQuery'
import {
  buildSnippet,
  insertsAsBlock,
  type PropValue,
} from '../lib/editor/snippet-builder'
import {
  insertSnippet,
  isOnEmptyLine,
} from '../lib/editor/commands/insertSnippet'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'
import { useEditorStore } from './editorStore'
import { useProjectStore } from './projectStore'
import { useUIStore } from './uiStore'

// Client directive types for framework components
export type ClientDirective =
  | 'none'
  | 'client:load'
  | 'client:idle'
  | 'client:visible'
  | 'client:media'
  | 'client:only'

// Define State and Actions
interface ComponentBuilderState {
  isOpen: boolean
  step: 'list' | 'configure'
  selectedComponent: MdxComponent | null
  /** Values entered in the form, by prop name. A missing key leaves the prop out. */
  values: Record<string, PropValue>
  editorView: EditorView | null
  clientDirective: ClientDirective
  /** The import the selected component needs, when the project adds them */
  importPlan: ImportPlan | null
  /** Whether insert() adds the planned import. Starts on each time. */
  addImport: boolean
}

interface ComponentBuilderActions {
  open: (view: EditorView) => void
  close: () => void
  selectComponent: (component: MdxComponent) => void
  setValue: (propName: string, value: PropValue | undefined) => void
  insert: () => void
  back: () => void
  setClientDirective: (directive: ClientDirective) => void
  setAddImport: (addImport: boolean) => void
}

const initialState: ComponentBuilderState = {
  isOpen: false,
  step: 'list',
  selectedComponent: null,
  values: {},
  editorView: null,
  clientDirective: 'none',
  importPlan: null,
  addImport: true,
}

/**
 * The import `component` needs in the open file, if the project has the
 * setting on. Planned once on selection: it doesn't depend on prop values, and
 * the file can't change while the builder is open. Null when there's no import
 * Rust can be sure of, which hides the preview row and adds nothing.
 */
async function planImport(
  component: MdxComponent,
  view: EditorView
): Promise<ImportPlan | null> {
  const { projectPath, currentProjectSettings } = useProjectStore.getState()
  const { currentFile, imports } = useEditorStore.getState()
  if (!currentProjectSettings?.addComponentImports) return null
  if (!projectPath || !currentFile) return null

  const collection = queryClient
    .getQueryData<Collection[]>(queryKeys.collections(projectPath))
    ?.find(c => c.name === currentFile.collection)
  if (!collection) return null

  const result = await commands.planComponentImport(
    projectPath,
    collection.path,
    currentFile.path,
    imports,
    view.state.doc.toString(),
    component
  )
  if (result.status === 'error') {
    void logWarn(
      `Could not plan the import for ${component.name}: ${result.error}`
    )
    return null
  }
  return result.data
}

// Create Store
export const useComponentBuilderStore = create<
  ComponentBuilderState & ComponentBuilderActions
>((set, get) => ({
  ...initialState,

  open: editorView => {
    // Show bars when component builder opens
    useUIStore.getState().setDistractionFreeBarsHidden(false)

    set({
      ...initialState,
      isOpen: true,
      editorView,
    })
  },

  close: () => {
    const { editorView } = get()
    set({ ...initialState })
    if (editorView) {
      setTimeout(() => {
        if (editorView.dom?.isConnected) {
          editorView.focus()
        }
      }, 100)
    }
  },

  selectComponent: component => {
    // Required switches start off, since they can't be left out
    const values: Record<string, PropValue> = {}
    for (const prop of component.props) {
      if (!prop.is_optional && prop.kind.kind === 'boolean') {
        values[prop.name] = false
      }
    }

    // Always show configuration step, even for components without props
    set({ selectedComponent: component, step: 'configure', values })

    const { editorView } = get()
    if (!editorView) return
    void planImport(component, editorView).then(importPlan => {
      // Unless the writer has gone back to the list since
      if (get().selectedComponent === component) set({ importPlan })
    })
  },

  setValue: (propName, value) => {
    set(state => {
      const values = { ...state.values }
      if (value === undefined) {
        delete values[propName]
      } else {
        values[propName] = value
      }
      return { values }
    })
  },

  insert: () => {
    const {
      selectedComponent,
      values,
      editorView,
      clientDirective,
      importPlan,
      addImport,
    } = get()
    if (!selectedComponent || !editorView) return

    const block = insertsAsBlock(selectedComponent, isOnEmptyLine(editorView))
    insertSnippet(
      editorView,
      buildSnippet(selectedComponent, values, clientDirective, block),
      { block }
    )
    if (importPlan?.kind === 'add' && addImport) {
      useEditorStore.getState().setImports(importPlan.imports)
    }
    get().close()
  },

  back: () =>
    set({
      step: 'list',
      selectedComponent: null,
      values: {},
      clientDirective: 'none',
      importPlan: null,
      addImport: true,
    }),

  setClientDirective: (directive: ClientDirective) =>
    set({ clientDirective: directive }),

  setAddImport: addImport => set({ addImport }),
}))
