import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { ensureSyntaxTree } from '@codemirror/language'
import { editorLanguage, setEditorLanguage } from './language'

const doc = ['<Card date={new Date()}>', 'Some **bold** text.', '</Card>'].join(
  '\n'
)

// Destroyed after each test: jsdom can't run the layout a live view measures
const views: EditorView[] = []
const editor = (path: string, text = doc) => {
  const view = new EditorView({
    state: EditorState.create({ doc: text, extensions: [editorLanguage()] }),
  })
  views.push(view)
  setEditorLanguage(view, path)
  return view
}

/** The innermost node just inside `text`, entering nested languages */
function nodeAt(view: EditorView, text: string): string {
  const { state } = view
  const tree = ensureSyntaxTree(state, state.doc.length, 1000)
  const pos = state.doc.toString().indexOf(text) + 1
  return tree!.resolveInner(pos, 1).name
}

describe('editor language', () => {
  afterEach(() => {
    views.splice(0).forEach(view => view.destroy())
  })

  it('reads Markdown inside a component in an .mdx file', () => {
    expect(nodeAt(editor('post.mdx'), '**bold**')).toBe('EmphasisMark')
  })

  it('parses MDX tags as JSX, and lone closing tags as HTML', () => {
    const view = editor('post.mdx')
    expect(nodeAt(view, 'new')).toBe('new')
    expect(nodeAt(view, 'Card>')).toBe('TagName')
  })

  it('keeps CommonMark HTML blocks in an .md file', () => {
    // The whole component is one HTML block, so the bold isn't Markdown
    const view = editor('post.md', '<Card>\nSome **bold** text.\n</Card>')
    expect(nodeAt(view, '**bold**')).toBe('Text')
  })
})
