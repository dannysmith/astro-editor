import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { undo, undoDepth } from '@codemirror/commands'
import { loadDocument, undoHistory } from './load-document'

// Destroyed after each test: jsdom can't run the layout a live view measures
const views: EditorView[] = []
const editor = (doc: string) => {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [undoHistory()] }),
  })
  views.push(view)
  return view
}

describe('loadDocument', () => {
  afterEach(() => {
    views.splice(0).forEach(view => view.destroy())
  })

  it("keeps undo from reaching the previous file's text", () => {
    const view = editor('File A')
    view.dispatch({ changes: { from: 6, insert: ' typed' } })
    expect(undoDepth(view.state)).toBe(1)

    loadDocument(view, 'File B')
    expect(undoDepth(view.state)).toBe(0)
    undo(view)

    expect(view.state.doc.toString()).toBe('File B')
  })

  it('records edits made after the load', () => {
    const view = editor('')
    loadDocument(view, 'File B')
    view.dispatch({ changes: { from: 6, insert: '!' } })

    undo(view)

    expect(view.state.doc.toString()).toBe('File B')
  })

  it('places the cursor where asked', () => {
    const view = editor('Old')
    loadDocument(view, 'New text', { anchor: 3 })
    expect(view.state.selection.main.anchor).toBe(3)
  })
})
