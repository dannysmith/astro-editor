import { describe, it, expect, afterEach, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { processDroppedFiles } from './fileProcessing'
import {
  handleTauriFileDrop,
  isDropWithinElement,
  selectionAfterInsert,
} from './handlers'
import type { ProcessedFile } from './types'

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

describe('selectionAfterInsert', () => {
  const file = (filename: string, isImage: boolean): ProcessedFile => ({
    originalPath: `/Users/me/${filename}`,
    filename,
    isImage,
    markdownText: isImage
      ? `![${filename}](./${filename})`
      : `[${filename}](./${filename})`,
  })

  it('selects the alt text of a single image', () => {
    const photo = file('IMG_1234.jpg', true)
    const doc = `Text ${photo.markdownText}`
    const { anchor, head } = selectionAfterInsert(5, photo.markdownText, [
      photo,
    ])
    expect(doc.slice(anchor, head)).toBe('IMG_1234.jpg')
  })

  it('puts the cursor after several images, or a file', () => {
    const files = [file('a.png', true), file('b.png', true)]
    const text = files.map(f => f.markdownText).join('\n')
    expect(selectionAfterInsert(5, text, files)).toEqual({
      anchor: 5 + text.length,
    })

    const pdf = file('notes.pdf', false)
    expect(selectionAfterInsert(0, pdf.markdownText, [pdf])).toEqual({
      anchor: pdf.markdownText.length,
    })
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
