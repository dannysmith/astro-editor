import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EditorView } from '@codemirror/view'
import type { ImportPlan, MdxComponent } from '@/types'
import { commands } from '@/lib/bindings'
import { useComponentBuilderStore } from './componentBuilderStore'
import { useEditorStore } from './editorStore'
import { useProjectStore } from './projectStore'

vi.mock('@/lib/bindings', () => ({
  commands: { planComponentImport: vi.fn() },
}))
vi.mock('../lib/query-client', () => ({
  queryClient: {
    getQueryData: () => [{ name: 'notes', path: '/site/src/content/notes' }],
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../lib/editor/commands/insertSnippet', () => ({
  insertSnippet: vi.fn(),
  isOnEmptyLine: () => true,
}))

const callout: MdxComponent = {
  name: 'Callout',
  file_path: 'src/components/mdx/Callout.astro',
  props: [],
  has_slot: false,
  description: null,
  framework: 'astro',
  import_source: null,
  named_export: false,
  slot_template: null,
}

const add: ImportPlan = {
  kind: 'add',
  imports: "import Callout from '../../components/mdx/Callout.astro'",
  statement: "import Callout from '../../components/mdx/Callout.astro'",
}

const view = { state: { doc: { toString: () => 'Body' } } } as EditorView

/** Selects Callout and waits for its plan */
async function select(plan: ImportPlan) {
  vi.mocked(commands.planComponentImport).mockResolvedValue({
    status: 'ok',
    data: plan,
  })
  useComponentBuilderStore.getState().open(view)
  useComponentBuilderStore.getState().selectComponent(callout)
  await vi.waitFor(() =>
    expect(useComponentBuilderStore.getState().importPlan).toEqual(plan)
  )
}

describe('componentBuilderStore imports', () => {
  beforeEach(() => {
    vi.mocked(commands.planComponentImport).mockReset()
    useProjectStore.setState({
      projectPath: '/site',
      currentProjectSettings: {
        pathOverrides: {},
        frontmatterMappings: {},
        addComponentImports: true,
      },
    })
    useEditorStore.setState({
      currentFile: {
        id: 'notes/a',
        path: '/site/src/content/notes/a.mdx',
        name: 'a',
        extension: 'mdx',
        collection: 'notes',
        last_modified: null,
        frontmatter: null,
      },
      imports: '',
      isDirty: false,
    })
  })

  it('adds the planned import on insert', async () => {
    await select(add)
    useComponentBuilderStore.getState().insert()
    expect(useEditorStore.getState().imports).toBe(add.imports)
    expect(useEditorStore.getState().isDirty).toBe(true)
  })

  it('adds nothing with the switch off', async () => {
    await select(add)
    useComponentBuilderStore.getState().setAddImport(false)

    useComponentBuilderStore.getState().insert()
    expect(useEditorStore.getState().imports).toBe('')
  })

  it("doesn't plan when the project setting is off", () => {
    useProjectStore.setState({
      currentProjectSettings: { pathOverrides: {}, frontmatterMappings: {} },
    })
    useComponentBuilderStore.getState().open(view)
    useComponentBuilderStore.getState().selectComponent(callout)
    expect(commands.planComponentImport).not.toHaveBeenCalled()
  })

  it('drops a plan that arrives after going back to the list', async () => {
    let resolve: (plan: ImportPlan) => void = () => {}
    vi.mocked(commands.planComponentImport).mockReturnValue(
      new Promise(r => {
        resolve = plan => r({ status: 'ok', data: plan })
      })
    )
    useComponentBuilderStore.getState().open(view)
    useComponentBuilderStore.getState().selectComponent(callout)
    useComponentBuilderStore.getState().back()

    resolve(add)
    await new Promise(r => setTimeout(r, 0))
    expect(useComponentBuilderStore.getState().importPlan).toBeNull()
  })
})
