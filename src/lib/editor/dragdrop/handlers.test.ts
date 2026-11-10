import { describe, it, expect, afterEach, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { processDroppedFiles } from './fileProcessing'
import { handleTauriFileDrop, isDropWithinElement } from './handlers'

vi.mock('./fileProcessing', () => ({ processDroppedFiles: vi.fn() }))

/** An element at 0,0 to 100,100, and a child inside it */
function target() {
  const element = document.createElement('div')
  const child = document.createElement('span')
  element.append(child)
  element.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 0, bottom: 100 }) as DOMRect
  return { element, child }
}

/** jsdom doesn't lay anything out, so say what's on top */
function onTop(element: Element | null) {
  document.elementFromPoint = () => element
}

describe('isDropWithinElement', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'elementFromPoint')
  })

  it('takes a drop on the element or something in it', () => {
    const { element, child } = target()
    onTop(child)
    expect(isDropWithinElement({ x: 50, y: 50 }, element)).toBe(true)
  })

  it('ignores a drop on something covering it, like a dialog', () => {
    const { element } = target()
    onTop(document.createElement('div'))
    expect(isDropWithinElement({ x: 50, y: 50 }, element)).toBe(false)
  })

  it('ignores a drop outside it', () => {
    const { element } = target()
    onTop(element)
    expect(isDropWithinElement({ x: 150, y: 50 }, element)).toBe(false)
    expect(isDropWithinElement(undefined, element)).toBe(false)
  })
})

describe('handleTauriFileDrop', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'elementFromPoint')
  })

  it("doesn't insert into a file opened while the image copies", async () => {
    const container = document.createElement('div')
    container.setAttribute('data-editor-container', '')
    container.getBoundingClientRect = () =>
      ({ left: 0, right: 100, top: 0, bottom: 100 }) as DOMRect
    document.body.append(container)
    const view = new EditorView({ doc: 'File B', parent: container })
    onTop(view.dom)

    const note = (id: string) => ({
      id,
      path: `/site/src/content/notes/${id}.md`,
      name: id,
      extension: 'md',
      collection: 'notes',
      last_modified: null,
      frontmatter: null,
      is_entry: true,
    })
    useProjectStore.setState({ projectPath: '/site' })
    useEditorStore.setState({ currentFile: note('a') })
    let finishCopy = () => {}
    vi.mocked(processDroppedFiles).mockReturnValue(
      new Promise(resolve => {
        finishCopy = () =>
          resolve([{ markdownText: '![](./photo.png)' } as never])
      })
    )

    const dropping = handleTauriFileDrop(
      { paths: ['/Users/me/photo.png'], position: { x: 50, y: 50 } },
      view
    )
    useEditorStore.setState({ currentFile: note('b') })
    finishCopy()

    await expect(dropping).resolves.toMatchObject({ success: false })
    expect(view.state.doc.toString()).toBe('File B')
    view.destroy()
    container.remove()
  })
})
