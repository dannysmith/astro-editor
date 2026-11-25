import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { codeBlockBackgroundExtension } from './code-block-background'

const doc = [
  'Some prose.',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  '> ```css',
  '> a { color: red }',
  '> ```',
].join('\n')

/** Line number → the classes the extension gives it */
function lineClasses(state: EditorState): Map<number, string> {
  const classes = new Map<number, string>()
  state
    .field(codeBlockBackgroundExtension)
    .between(0, state.doc.length, (from, _, deco) => {
      const spec = deco.spec as { class: string }
      classes.set(state.doc.lineAt(from).number, spec.class)
    })
  return classes
}

/** The numbers of the lines that have `className` */
const linesWith = (state: EditorState, className: string) =>
  [...lineClasses(state)]
    .filter(([, classes]) => classes.split(' ').includes(className))
    .map(([line]) => line)

/**
 * A state with the cursor at `cursor`. The parser's first pass has a time
 * budget a busy test run can exceed, so the parse is finished and the field
 * rebuilt from the whole tree
 */
const create = (cursor: number, text = doc) => {
  const state = EditorState.create({
    doc: text,
    extensions: [markdown(), codeBlockBackgroundExtension],
  })
  ensureSyntaxTree(state, text.length, 5000)
  return state.update({ selection: { anchor: cursor } }).state
}

describe('codeBlockBackgroundExtension', () => {
  it('marks every line of each fenced block, including ones in a quote', () => {
    const state = create(0)
    expect([...lineClasses(state).keys()]).toEqual([3, 4, 5, 7, 8, 9])
    expect(linesWith(state, 'cm-codeblock-first')).toEqual([3, 7])
    expect(linesWith(state, 'cm-codeblock-last')).toEqual([5, 9])
  })

  it('marks the fence lines, which keep their colours outside the active block', () => {
    expect(linesWith(create(0), 'cm-codeblock-fence')).toEqual([3, 5, 7, 9])
  })

  it("doesn't take the last line of an unclosed block for a fence", () => {
    const state = create(0, 'Prose.\n\n```js\nconst a = 1\nconst b = 2')
    expect(linesWith(state, 'cm-codeblock-last')).toEqual([5])
    expect(linesWith(state, 'cm-codeblock-fence')).toEqual([3])
  })

  it('marks only the block holding the cursor as active', () => {
    const state = create(doc.indexOf('const'))
    expect(linesWith(state, 'cm-codeblock-active')).toEqual([3, 4, 5])
  })

  it('moves the active block with the cursor', () => {
    const state = create(doc.indexOf('const')).update({
      selection: { anchor: doc.indexOf('color') },
    }).state
    expect(linesWith(state, 'cm-codeblock-active')).toEqual([7, 8, 9])
  })
})
