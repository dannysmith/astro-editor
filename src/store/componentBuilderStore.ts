import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import {
  commands,
  type Collection,
  type ImageImport,
  type ImportPlan,
} from '@/types'
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
import { toast } from '../lib/toast'
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
  /** The imports the component and its images need, when the project adds them */
  importPlan: ImportPlan | null
  /** Whether insert() adds the planned imports. Starts on each time. */
  addImport: boolean
  /** The image picked for each image prop. Its value is the name it's imported as. */
  images: Record<string, ImageImport>
}

interface ComponentBuilderActions {
  open: (view: EditorView) => void
  close: () => void
  selectComponent: (component: MdxComponent) => void
  setValue: (propName: string, value: PropValue | undefined) => void
  /** Picks or clears an image prop's image, keeping it if it can be imported */
  setImage: (propName: string, image: ImageImport | undefined) => Promise<void>
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
  images: {},
}

/** Whether the open project has the builder add imports */
function addsImports(): boolean {
  return (
    useProjectStore.getState().currentProjectSettings?.addComponentImports ??
    false
  )
}

/**
 * Plans the imports for `component` and `images` in the open file. A null
 * plan, when the project doesn't add imports or Rust can't be sure of them,
 * hides the import row and adds nothing. An error when an image can't be
 * imported. The file can't change while the builder is open, so this only
 * reruns when the images do.
 */
async function planImports(
  component: MdxComponent,
  view: EditorView,
  images: ImageImport[]
): Promise<{ plan: ImportPlan | null } | { error: string }> {
  const { projectPath } = useProjectStore.getState()
  const { currentFile, imports } = useEditorStore.getState()
  if (!addsImports() || !projectPath || !currentFile) return { plan: null }

  const collection = queryClient
    .getQueryData<Collection[]>(queryKeys.collections(projectPath))
    ?.find(c => c.name === currentFile.collection)
  if (!collection) return { plan: null }

  const result = await commands.planComponentImport(
    projectPath,
    collection.path,
    currentFile.path,
    imports,
    view.state.doc.toString(),
    component,
    images
  )
  if (result.status === 'error') return { error: result.error }
  if (!result.data && images.length > 0) {
    return { error: "Its import can't be added to this file" }
  }
  return { plan: result.data }
}

/**
 * The component and values to build the tag from. With imports switched off,
 * a picked image goes in as its path, `image="../../assets/a.png"`, which is
 * easier to sort out in a code editor than a name nothing imports.
 */
export function snippetInput(
  component: MdxComponent,
  values: Record<string, PropValue>,
  images: Record<string, ImageImport>,
  addImport: boolean
): { component: MdxComponent; values: Record<string, PropValue> } {
  const picked = Object.keys(images)
  if (addImport || picked.length === 0) return { component, values }
  return {
    component: {
      ...component,
      props: component.props.map(prop =>
        prop.name in images ? { ...prop, kind: { kind: 'string' } } : prop
      ),
    },
    values: {
      ...values,
      ...Object.fromEntries(
        picked.map(prop => [prop, images[prop]!.specifier])
      ),
    },
  }
}

/** Counts plan requests, so only the newest one's answer is used */
let planRequests = 0

// Create Store
export const useComponentBuilderStore = create<
  ComponentBuilderState & ComponentBuilderActions
>((set, get) => {
  /**
   * Plans with `images`, then keeps them, the plan and each image's name as its
   * prop's value. Returns the error, leaving everything as it was, when they
   * can't be imported.
   */
  const plan = async (
    images: Record<string, ImageImport>
  ): Promise<string | undefined> => {
    const { selectedComponent: component, editorView } = get()
    if (!component || !editorView) return
    const request = ++planRequests
    const props = Object.keys(images)
    const result = await planImports(
      component,
      editorView,
      props.map(prop => images[prop]!)
    )
    // Unless the writer has gone back to the list, or picked again, since
    if (request !== planRequests || get().selectedComponent !== component) {
      return
    }
    if ('error' in result) return result.error

    const values = { ...get().values }
    for (const prop of Object.keys(get().images)) delete values[prop]
    props.forEach((prop, i) => {
      const name = result.plan?.images[i]
      if (name) values[prop] = name
    })
    set({ importPlan: result.plan, images, values })
  }

  return {
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

      void plan({}).then(error => {
        if (error) {
          void logWarn(
            `Could not plan the import for ${component.name}: ${error}`
          )
        }
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

    setImage: async (propName, image) => {
      const images = { ...get().images }
      if (image) {
        images[propName] = image
      } else {
        delete images[propName]
      }
      const error = await plan(images)
      if (error) {
        toast.error('Couldn’t use that image', { description: error })
      }
    },

    insert: () => {
      const {
        selectedComponent,
        values,
        editorView,
        clientDirective,
        importPlan,
        addImport,
        images,
      } = get()
      if (!selectedComponent || !editorView) return

      const block = insertsAsBlock(selectedComponent, isOnEmptyLine(editorView))
      const snippet = snippetInput(selectedComponent, values, images, addImport)
      insertSnippet(
        editorView,
        buildSnippet(snippet.component, snippet.values, clientDirective, block),
        { block }
      )
      if (importPlan && importPlan.added.length > 0 && addImport) {
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
        images: {},
      }),

    setClientDirective: (directive: ClientDirective) =>
      set({ clientDirective: directive }),

    setAddImport: addImport => set({ addImport }),
  }
})
