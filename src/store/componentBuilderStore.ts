import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import {
  commands,
  type Collection,
  type EntryImport,
  type ImageImport,
  type ImportPlan,
} from '@/types'
import { MdxComponent } from '../hooks/queries/useMdxComponentsQuery'
import {
  buildSnippet,
  insertsAsBlock,
  withPicks,
  type Picks,
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
  /** The imports the component and its picks need, when the project adds them */
  importPlan: ImportPlan | null
  /** Whether a plan is on its way */
  planning: boolean
  /** Whether insert() adds the planned imports. Starts on each time. */
  addImport: boolean
  /** The image picked for each image prop */
  images: Record<string, ImageImport>
  /** The entry picked for each entry prop */
  entries: Record<string, EntryImport>
}

interface ComponentBuilderActions {
  open: (view: EditorView) => void
  close: () => void
  selectComponent: (component: MdxComponent) => void
  setValue: (propName: string, value: PropValue | undefined) => void
  /** Picks or clears an image prop's image, dropping it if it can't be imported */
  setImage: (prop: string, image?: Omit<ImageImport, 'prop'>) => Promise<void>
  /** Picks or clears an entry prop's collection entry */
  setEntry: (prop: string, entry?: Omit<EntryImport, 'prop'>) => Promise<void>
  insert: () => Promise<void>
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
  planning: false,
  addImport: true,
  images: {},
  entries: {},
}

/**
 * Plans the imports for `component` and `picks` in the open file as it is now.
 * A null plan, when the project doesn't add imports or Rust can't be sure of
 * them, hides the import row, and picks then go in as their path or id. An
 * error when an image can't be imported.
 */
async function planImports(
  component: MdxComponent,
  view: EditorView,
  picks: Picks
): Promise<{ plan: ImportPlan | null } | { error: string }> {
  const { projectPath, currentProjectSettings } = useProjectStore.getState()
  const { currentFile, imports } = useEditorStore.getState()
  if (!currentProjectSettings?.addComponentImports) return { plan: null }
  if (!projectPath || !currentFile) return { plan: null }

  const collection = queryClient
    .getQueryData<Collection[]>(queryKeys.collections(projectPath))
    ?.find(c => c.name === currentFile.collection)
  if (!collection) return { plan: null }

  try {
    const result = await commands.planComponentImport(
      projectPath,
      collection.path,
      currentFile.path,
      imports,
      view.state.doc.toString(),
      component,
      {
        images: Object.values(picks.images),
        entries: Object.values(picks.entries),
      }
    )
    return result.status === 'error'
      ? { error: result.error }
      : { plan: result.data }
  } catch (error) {
    // The bindings rethrow errors from the IPC itself
    return { error: String(error) }
  }
}

/** `record` with `value` for `key`, or without `key` when there's no value */
function withKey<T>(
  record: Record<string, T>,
  key: string,
  value: T | undefined
): Record<string, T> {
  const next = { ...record }
  if (value === undefined) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}

/** Counts plan requests, so only the newest one's answer is used */
let planRequests = 0

// Create Store
export const useComponentBuilderStore = create<
  ComponentBuilderState & ComponentBuilderActions
>((set, get) => {
  /**
   * Plans for the current picks and keeps the plan, for the import row and the
   * tag preview. Returns the error when a pick can't be imported. Answers that
   * arrive after the writer has picked again or gone back are dropped.
   */
  const plan = async (): Promise<string | undefined> => {
    const { selectedComponent: component, editorView, images, entries } = get()
    if (!component || !editorView) return
    const request = ++planRequests
    set({ planning: true })
    const result = await planImports(component, editorView, { images, entries })
    if (request !== planRequests || get().selectedComponent !== component) {
      return
    }
    set({ planning: false })
    if ('error' in result) return result.error
    set({ importPlan: result.plan })
  }

  /**
   * Changes the picks straight away, so a second pick builds on the first, then
   * drops the change again if its import can't be planned
   */
  const pick = async (change: (picks: Picks) => Picks, failure: string) => {
    const { images, entries } = get()
    const before = { images, entries }
    const after = change(before)
    set(after)
    const error = await plan()
    if (error) {
      if (get().images === after.images && get().entries === after.entries) {
        set(before)
      }
      toast.error(failure, { description: error })
      void plan()
    }
  }

  /** Whether an insert is waiting for its plan, so a second one is ignored */
  let inserting = false

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

      void plan().then(error => {
        if (error) {
          void logWarn(
            `Could not plan the import for ${component.name}: ${error}`
          )
        }
      })
    },

    setValue: (propName, value) =>
      set(state => ({ values: withKey(state.values, propName, value) })),

    setImage: (prop, image) =>
      pick(
        picks => ({
          ...picks,
          images: withKey(picks.images, prop, image && { ...image, prop }),
        }),
        'Couldn’t use that image'
      ),

    setEntry: (prop, entry) =>
      pick(
        picks => ({
          ...picks,
          entries: withKey(picks.entries, prop, entry && { ...entry, prop }),
        }),
        'Couldn’t use that entry'
      ),

    insert: async () => {
      const {
        selectedComponent: component,
        values,
        editorView,
        clientDirective,
        addImport,
        images,
        entries,
      } = get()
      if (!component || !editorView || inserting) return

      // Plan again against the file as it is now: the plan shown may not have
      // arrived yet, and the file can change on disk while the builder is open
      inserting = true
      const result = addImport
        ? await planImports(component, editorView, { images, entries })
        : { plan: null }
      inserting = false
      if (get().selectedComponent !== component) return
      const plan = 'plan' in result ? result.plan : null

      const block = insertsAsBlock(component, isOnEmptyLine(editorView))
      const tag = withPicks(component, values, { images, entries }, plan?.names)
      insertSnippet(
        editorView,
        buildSnippet(tag.component, tag.values, clientDirective, block),
        { block }
      )
      if (plan && plan.added.length > 0) {
        useEditorStore.getState().setImports(plan.imports)
      }
      get().close()
    },

    back: () => {
      planRequests++
      set({
        step: 'list',
        selectedComponent: null,
        values: {},
        clientDirective: 'none',
        importPlan: null,
        planning: false,
        addImport: true,
        images: {},
        entries: {},
      })
    },

    setClientDirective: (directive: ClientDirective) =>
      set({ clientDirective: directive }),

    setAddImport: addImport => set({ addImport }),
  }
})
