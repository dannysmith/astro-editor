import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
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
}

interface ComponentBuilderActions {
  open: (view: EditorView) => void
  close: () => void
  selectComponent: (component: MdxComponent) => void
  setValue: (propName: string, value: PropValue | undefined) => void
  insert: () => void
  back: () => void
  setClientDirective: (directive: ClientDirective) => void
}

const initialState: ComponentBuilderState = {
  isOpen: false,
  step: 'list',
  selectedComponent: null,
  values: {},
  editorView: null,
  clientDirective: 'none',
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
    const { selectedComponent, values, editorView, clientDirective } = get()
    if (!selectedComponent || !editorView) return

    const block = insertsAsBlock(selectedComponent, isOnEmptyLine(editorView))
    insertSnippet(
      editorView,
      buildSnippet(selectedComponent, values, clientDirective, block),
      { block }
    )
    get().close()
  },

  back: () =>
    set({
      step: 'list',
      selectedComponent: null,
      values: {},
      clientDirective: 'none',
    }),

  setClientDirective: (directive: ClientDirective) =>
    set({ clientDirective: directive }),
}))
