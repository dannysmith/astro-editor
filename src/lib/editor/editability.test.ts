import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { editability, editabilityCompartment } from './editability'
import { loadDocument, undoHistory } from './load-document'

// Destroyed after each test: jsdom can't run the layout a live view measures
const views: EditorView[] = []
const editor = (editingPaused: boolean) => {
  const view = new EditorView({
    state: EditorState.create({
      doc: 'before',
      extensions: [
        undoHistory(),
        editabilityCompartment.of(
          editability({ isLoaded: true, editingPaused })
        ),
      ],
    }),
  })
  views.push(view)
  return view
}

describe('editability', () => {
  afterEach(() => {
    views.splice(0).forEach(view => view.destroy())
  })

  it('refuses changes while editing is paused, but not a file load', () => {
    const view = editor(true)
    expect(view.state.readOnly).toBe(true)
    // What a formatting command, drop or fix does
    view.dispatch({ changes: { from: 0, insert: 'typed ' } })
    expect(view.state.doc.toString()).toBe('before')

    loadDocument(view, 'pulled')
    expect(view.state.doc.toString()).toBe('pulled')
  })

  it('allows changes again when the pause ends', () => {
    const view = editor(true)
    view.dispatch({
      effects: editabilityCompartment.reconfigure(
        editability({ isLoaded: true, editingPaused: false })
      ),
    })
    expect(view.state.readOnly).toBe(false)
    view.dispatch({ changes: { from: 0, insert: 'typed ' } })
    expect(view.state.doc.toString()).toBe('typed before')
  })
})
