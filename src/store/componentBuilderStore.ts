import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { MdxComponent } from '../hooks/queries/useMdxComponentsQuery'
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
  enabledProps: Set<string>
  editorView: EditorView | null
  propSearchQuery: string
  clientDirective: ClientDirective
}

interface ComponentBuilderActions {
  open: (view: EditorView) => void
  close: () => void
  selectComponent: (component: MdxComponent) => void
  toggleProp: (propName: string) => void
  insert: () => void
  back: () => void
  setPropSearchQuery: (query: string) => void
  setClientDirective: (directive: ClientDirective) => void
}

const initialState: ComponentBuilderState = {
  isOpen: false,
  step: 'list',
  selectedComponent: null,
  enabledProps: new Set(),
  editorView: null,
  propSearchQuery: '',
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

  close: () => set({ ...initialState }), // Fully reset on close

  selectComponent: component => {
    const requiredProps = new Set(
      component.props.filter(p => !p.is_optional).map(p => p.name)
    )

    // Always show configuration step, even for components without props
    set({
      selectedComponent: component,
      step: 'configure',
      enabledProps: requiredProps,
      propSearchQuery: '', // Reset search when selecting a component
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
    const { selectedComponent, enabledProps, editorView, clientDirective } =
      get()
    if (!selectedComponent || !editorView) return

    // Import the snippet builder and insert command dynamically to avoid circular dependencies
    void (async () => {
      const { buildSnippet } = await import('../lib/editor/snippet-builder')
      const { insertSnippet } = await import(
        '../lib/editor/commands/insertSnippet'
      )

      const snippetString = buildSnippet(
        selectedComponent,
        enabledProps,
        clientDirective
      )
      insertSnippet(editorView, snippetString)
      get().close() // Close and reset after insertion

      // Focus the editor after a short delay to ensure dialog has closed
      setTimeout(() => {
        editorView.focus()
      }, 100)
    })()
  },

  back: () =>
    set({
      step: 'list',
      selectedComponent: null,
      enabledProps: new Set(),
      propSearchQuery: '',
      clientDirective: 'none',
    }),

  setPropSearchQuery: (query: string) => set({ propSearchQuery: query }),

  setClientDirective: (directive: ClientDirective) =>
    set({ clientDirective: directive }),
}))
