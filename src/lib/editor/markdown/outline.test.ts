import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { editorLanguage } from '../syntax/language'
import { filterHeadings, getDocumentHeadings, goToHeading } from './outline'

const doc = [
  '# Title',
  '',
  'Intro.',
  '',
  '## First *section* ##',
  '',
  '```python',
  '# Not a heading',
  '```',
  '',
  'Setext heading',
  '--------------',
  '',
  '### ',
  '',
  '### Deeper',
].join('\n')

const state = (text = doc) =>
  EditorState.create({ doc: text, extensions: [editorLanguage()] })

describe('getDocumentHeadings', () => {
  it('lists headings in order with their levels, skipping code and empty ones', () => {
    expect(
      getDocumentHeadings(state()).map(({ level, text }) => [level, text])
    ).toEqual([
      [1, 'Title'],
      [2, 'First *section*'],
      [2, 'Setext heading'],
      [3, 'Deeper'],
    ])
  })

  it('ends each heading at the end of its text, before closing marks', () => {
    const s = state()
    const ends = getDocumentHeadings(s).map(h =>
      s.doc.sliceString(h.to - 4, h.to)
    )
    expect(ends).toEqual(['itle', 'ion*', 'ding', 'eper'])
  })

  it('returns nothing for a document without headings', () => {
    expect(getDocumentHeadings(state('Just a paragraph.'))).toEqual([])
  })
})

describe('filterHeadings', () => {
  const headings = getDocumentHeadings(state())

  it('lists every heading for a bare #', () => {
    expect(filterHeadings(headings, '#')).toEqual(headings)
    expect(filterHeadings(headings, '## ')).toEqual(headings)
  })

  it('matches fuzzily and keeps document order', () => {
    expect(filterHeadings(headings, '#dpr').map(h => h.text)).toEqual([
      'Deeper',
    ])
    expect(filterHeadings(headings, '# e').map(h => h.text)).toEqual([
      'Title',
      'First *section*',
      'Setext heading',
      'Deeper',
    ])
  })
})

describe('goToHeading', () => {
  const views: EditorView[] = []
  afterEach(() => {
    views.splice(0).forEach(view => view.destroy())
  })

  it('puts the cursor at the end of the heading', () => {
    const view = new EditorView({ state: state() })
    views.push(view)
    const deeper = getDocumentHeadings(view.state).at(-1)!
    goToHeading(view, deeper)
    expect(view.state.selection.main.head).toBe(view.state.doc.length)
  })
})
