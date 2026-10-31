import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EditorView } from '@codemirror/view'
import type { ImportPlan, MdxComponent, PropImports } from '@/types'
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

const planComponentImport = vi.mocked(commands.planComponentImport)

/** A component with an image prop and a collection-entry prop */
const figure: MdxComponent = {
  name: 'Figure',
  file_path: 'src/components/mdx/Figure.astro',
  props: [
    {
      name: 'image',
      prop_type: 'ImageMetadata',
      kind: { kind: 'image' },
      is_optional: true,
      default_value: null,
      description: null,
    },
    {
      name: 'related',
      prop_type: "CollectionEntry<'articles'>",
      kind: { kind: 'collectionEntry', collection: 'articles' },
      is_optional: true,
      default_value: null,
      description: null,
    },
  ],
  has_slot: false,
  description: null,
  framework: 'astro',
  import_source: null,
  named_export: false,
  slot_template: null,
}

const rocket = { file_name: 'rocket.png', specifier: './rocket.png' }
const first = { collection: 'articles', id: 'first-article' }

/** A plan that adds Figure's import, and names the given props' picks */
function planWith(names: Record<string, string> = {}): ImportPlan {
  return {
    imports: "import Figure from '../../components/mdx/Figure.astro'",
    added: ["import Figure from '../../components/mdx/Figure.astro'"],
    existing: null,
    names,
  }
}

function answer(plan: ImportPlan | null) {
  return { status: 'ok' as const, data: plan }
}

/** The picks the last plan was asked for */
function lastPicks(): PropImports | undefined {
  return planComponentImport.mock.lastCall?.[6]
}

/** The snippet the last insert put in the editor */
function inserted(): string | undefined {
  return vi.mocked(insertSnippet).mock.lastCall?.[1]
}

const view = { state: { doc: { toString: () => 'Body' } } } as EditorView

/** Opens the builder on Figure and waits for its first plan */
async function select() {
  useComponentBuilderStore.getState().open(view)
  useComponentBuilderStore.getState().selectComponent(figure)
  await vi.waitFor(() =>
    expect(useComponentBuilderStore.getState().planning).toBe(false)
  )
}

/** Promises that settle when told to, for answers that arrive out of order */
function deferred() {
  let resolve: (plan: ImportPlan | null) => void = () => {}
  const promise = new Promise<ReturnType<typeof answer>>(r => {
    resolve = plan => r(answer(plan))
  })
  return { promise, resolve }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('componentBuilderStore imports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planComponentImport.mockResolvedValue(answer(planWith()))
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
    await select()
    await useComponentBuilderStore.getState().insert()
    expect(useEditorStore.getState().imports).toBe(planWith().imports)
    expect(useEditorStore.getState().isDirty).toBe(true)
  })

  it('plans again on insert, against the file as it is then', async () => {
    const pending = deferred()
    planComponentImport.mockReturnValueOnce(pending.promise)
    useComponentBuilderStore.getState().open(view)
    useComponentBuilderStore.getState().selectComponent(figure)

    // Insert before the first plan arrives, after the block changed on disk
    useEditorStore.setState({ imports: "import a from 'a'" })
    await useComponentBuilderStore.getState().insert()
    expect(planComponentImport.mock.lastCall?.[3]).toBe("import a from 'a'")
    expect(useEditorStore.getState().imports).toBe(planWith().imports)
  })

  it('adds nothing with the switch off', async () => {
    await select()
    useComponentBuilderStore.getState().setAddImport(false)
    await useComponentBuilderStore.getState().insert()
    expect(useEditorStore.getState().imports).toBe('')
  })

  it("doesn't plan when the project setting is off", async () => {
    useProjectStore.setState({
      currentProjectSettings: { pathOverrides: {}, frontmatterMappings: {} },
    })
    await select()
    expect(planComponentImport).not.toHaveBeenCalled()
    expect(useComponentBuilderStore.getState().importPlan).toBeNull()
  })

  it('drops a plan that arrives after going back to the list', async () => {
    const pending = deferred()
    planComponentImport.mockReturnValueOnce(pending.promise)
    useComponentBuilderStore.getState().open(view)
    useComponentBuilderStore.getState().selectComponent(figure)
    useComponentBuilderStore.getState().back()

    pending.resolve(planWith())
    await flush()
    expect(useComponentBuilderStore.getState().importPlan).toBeNull()
  })

  it('uses the newest plan when picks are answered out of order', async () => {
    await select()
    const a = deferred()
    const b = deferred()
    planComponentImport.mockReturnValueOnce(a.promise)
    planComponentImport.mockReturnValueOnce(b.promise)

    void useComponentBuilderStore.getState().setImage('image', rocket)
    void useComponentBuilderStore.getState().setEntry('related', first)
    // The second pick builds on the first
    expect(lastPicks()).toEqual({
      images: [{ ...rocket, prop: 'image' }],
      entries: [{ ...first, prop: 'related' }],
    })

    b.resolve(planWith({ image: 'rocket', related: 'firstArticle' }))
    a.resolve(planWith({ image: 'rocket' }))
    await flush()
    expect(useComponentBuilderStore.getState().importPlan?.names).toEqual({
      image: 'rocket',
      related: 'firstArticle',
    })
  })

  it('inserts picks as the names they were imported and loaded as', async () => {
    await select()
    planComponentImport.mockResolvedValue(
      answer(planWith({ image: 'rocket', related: 'firstArticle' }))
    )
    await useComponentBuilderStore.getState().setImage('image', rocket)
    await useComponentBuilderStore.getState().setEntry('related', first)
    await useComponentBuilderStore.getState().insert()
    expect(inserted()).toContain('image={rocket}')
    expect(inserted()).toContain('related={firstArticle}')
  })

  it('inserts picks as their path and id when there are no imports', async () => {
    // With the switch off, or when nothing could be planned
    for (const off of [true, false]) {
      await select()
      await useComponentBuilderStore.getState().setImage('image', rocket)
      await useComponentBuilderStore.getState().setEntry('related', first)
      if (off) {
        useComponentBuilderStore.getState().setAddImport(false)
      } else {
        planComponentImport.mockResolvedValue(answer(null))
      }
      await useComponentBuilderStore.getState().insert()
      expect(inserted()).toContain('image="./rocket.png"')
      expect(inserted()).toContain('related="first-article"')
    }
  })

  it("drops an image that can't be imported", async () => {
    await select()
    planComponentImport.mockResolvedValueOnce({
      status: 'error',
      error: "b.png isn't in src/",
    })
    await useComponentBuilderStore
      .getState()
      .setImage('image', { file_name: 'b.png', specifier: '/public/b.png' })
    expect(toast.error).toHaveBeenCalledWith('Couldn’t use that image', {
      description: "b.png isn't in src/",
    })
    expect(useComponentBuilderStore.getState().images).toEqual({})
  })
})
