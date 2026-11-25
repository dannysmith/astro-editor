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
    .between(0, doc.length, (from, _, deco) => {
      const spec = deco.spec as { class: string }
      classes.set(state.doc.lineAt(from).number, spec.class)
    })
  return classes
}

/**
 * A state with the cursor at `cursor`. The parser's first pass has a time
 * budget a busy test run can exceed, so the parse is finished and the field
 * rebuilt from the whole tree
 */
const create = (cursor: number) => {
  const state = EditorState.create({
    doc,
    extensions: [markdown(), codeBlockBackgroundExtension],
  })
  ensureSyntaxTree(state, doc.length, 5000)
  return state.update({ selection: { anchor: cursor } }).state
}

describe('codeBlockBackgroundExtension', () => {
  it('marks every line of each fenced block, including ones in a quote', () => {
    const classes = lineClasses(create(0))
    expect([...classes.keys()]).toEqual([3, 4, 5, 7, 8, 9])
    expect(classes.get(3)).toBe('cm-codeblock-line cm-codeblock-first')
    expect(classes.get(5)).toBe('cm-codeblock-line cm-codeblock-last')
  })

  it('marks only the block holding the cursor as active', () => {
    const inJs = create(doc.indexOf('const'))
    const active = [...lineClasses(inJs)]
      .filter(([, cls]) => cls.includes('cm-codeblock-active'))
      .map(([line]) => line)
    expect(active).toEqual([3, 4, 5])
  })

  it('moves the active block with the cursor', () => {
    const state = create(doc.indexOf('const')).update({
      selection: { anchor: doc.indexOf('color') },
    }).state
    const active = [...lineClasses(state)]
      .filter(([, cls]) => cls.includes('cm-codeblock-active'))
      .map(([line]) => line)
    expect(active).toEqual([7, 8, 9])
  })
})
