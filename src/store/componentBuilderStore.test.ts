import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EditorView } from '@codemirror/view'
import type { ImportPlan, MdxComponent } from '@/types'
import { commands } from '@/lib/bindings'
import { toast } from '../lib/toast'
import { insertSnippet } from '../lib/editor/commands/insertSnippet'
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
vi.mock('../lib/toast', () => ({ toast: { error: vi.fn() } }))

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
  imports: "import Callout from '../../components/mdx/Callout.astro'",
  added: ["import Callout from '../../components/mdx/Callout.astro'"],
  existing: null,
  images: [],
  entries: [],
}

const view = { state: { doc: { toString: () => 'Body' } } } as EditorView

/** Selects Callout and waits for its plan */
async function select(plan: ImportPlan, component = callout) {
  vi.mocked(commands.planComponentImport).mockResolvedValue({
    status: 'ok',
    data: plan,
  })
  useComponentBuilderStore.getState().open(view)
  useComponentBuilderStore.getState().selectComponent(component)
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

  it('sets an image prop to the name its image is imported as', async () => {
    await select(add)
    const rocket = { file_name: 'rocket.png', specifier: './rocket.png' }
    vi.mocked(commands.planComponentImport).mockResolvedValue({
      status: 'ok',
      data: { ...add, images: ['rocket'] },
    })

    await useComponentBuilderStore.getState().setImage('image', rocket)
    expect(vi.mocked(commands.planComponentImport).mock.lastCall?.[6]).toEqual({
      images: [rocket],
      entries: [],
    })
    expect(useComponentBuilderStore.getState().values.image).toBe('rocket')

    await useComponentBuilderStore.getState().setImage('image', undefined)
    expect(useComponentBuilderStore.getState().values.image).toBeUndefined()
  })

  it('inserts a picked image as its path with the switch off', async () => {
    const figure: MdxComponent = {
      ...callout,
      name: 'Figure',
      props: [
        {
          name: 'image',
          prop_type: 'ImageMetadata',
          kind: { kind: 'image' },
          is_optional: false,
          default_value: null,
          description: null,
        },
      ],
    }
    await select(add, figure)
    vi.mocked(commands.planComponentImport).mockResolvedValue({
      status: 'ok',
      data: { ...add, images: ['rocket'] },
    })
    await useComponentBuilderStore
      .getState()
      .setImage('image', { file_name: 'rocket.png', specifier: './rocket.png' })

    const snippet = () => vi.mocked(insertSnippet).mock.lastCall?.[1]
    useComponentBuilderStore.getState().insert()
    expect(snippet()).toContain('image={rocket}')

    await select(add, figure)
    await useComponentBuilderStore
      .getState()
      .setImage('image', { file_name: 'rocket.png', specifier: './rocket.png' })
    useComponentBuilderStore.getState().setAddImport(false)
    useComponentBuilderStore.getState().insert()
    expect(snippet()).toContain('image="./rocket.png"')
  })

  it('sets an entry prop to the name it loads its entry as', async () => {
    const figure: MdxComponent = {
      ...callout,
      name: 'Figure',
      props: [
        {
          name: 'related',
          prop_type: "CollectionEntry<'articles'>",
          kind: { kind: 'collectionEntry', collection: 'articles' },
          is_optional: true,
          default_value: null,
          description: null,
        },
      ],
    }
    const first = { collection: 'articles', id: 'first-article' }
    await select(add, figure)
    vi.mocked(commands.planComponentImport).mockResolvedValue({
      status: 'ok',
      data: { ...add, entries: ['firstArticle'] },
    })
    await useComponentBuilderStore.getState().setEntry('related', first)
    expect(vi.mocked(commands.planComponentImport).mock.lastCall?.[6]).toEqual({
      images: [],
      entries: [first],
    })

    const snippet = () => vi.mocked(insertSnippet).mock.lastCall?.[1]
    useComponentBuilderStore.getState().setAddImport(false)
    useComponentBuilderStore.getState().insert()
    // With the switch off, the entry goes in as its id
    expect(snippet()).toContain('related="first-article"')

    await select(add, figure)
    vi.mocked(commands.planComponentImport).mockResolvedValue({
      status: 'ok',
      data: { ...add, entries: ['firstArticle'] },
    })
    await useComponentBuilderStore.getState().setEntry('related', first)
    useComponentBuilderStore.getState().insert()
    expect(snippet()).toContain('related={firstArticle}')
  })

  it("keeps out an image that can't be imported", async () => {
    await select(add)
    vi.mocked(commands.planComponentImport).mockResolvedValue({
      status: 'error',
      error: "b.png isn't in src/",
    })

    await useComponentBuilderStore
      .getState()
      .setImage('image', { file_name: 'b.png', specifier: '/public/b.png' })
    expect(toast.error).toHaveBeenCalled()
    expect(useComponentBuilderStore.getState().images).toEqual({})
    expect(useComponentBuilderStore.getState().importPlan).toEqual(add)
  })
})
