import { describe, it, expect } from 'vitest'
import { linter, setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { addIssue, applyFix, currentIssues, type Fix } from './issues'

/** A view of `doc` with one issue on `text`, which `fix` fixes */
function withIssue(doc: string, text: string, fix: Fix) {
  const view = new EditorView({ doc, extensions: [linter(null)] })
  const from = doc.indexOf(text)
  const diagnostic: Diagnostic = {
    from,
    to: from + text.length,
    severity: 'info',
    message: '',
  }
  addIssue(diagnostic, {
    check: 'spelling',
    kind: 'Spelling',
    text,
    fixes: [fix],
    word: null,
    ignore: () => Promise.resolve(),
  })
  view.dispatch(setDiagnostics(view.state, [diagnostic]))
  return { view, diagnostic }
}

const replaceWith = (replacement: string): Fix => ({
  label: replacement,
  apply: (view, from, to) =>
    view.dispatch({ changes: { from, to, insert: replacement } }),
})

const insertAfter = (insert: string): Fix => ({
  label: insert,
  apply: (view, _from, to) => view.dispatch({ changes: { from: to, insert } }),
})

describe('applyFix', () => {
  it('applies a fix to the text the issue was raised on', () => {
    const fix = replaceWith('mistake')
    const { view, diagnostic } = withIssue('A mistaek here.', 'mistaek', fix)
    applyFix(view, diagnostic, fix)
    expect(view.state.doc.toString()).toBe('A mistake here.')
  })

  it("does nothing once the text has changed, so typing isn't lost", () => {
    const fix = replaceWith('to')
    const { view, diagnostic } = withIssue(
      'We did it in order to ship.',
      'in order to',
      fix
    )
    // Typing inside the issue widens it
    const at = 'We did it in order'.length
    view.dispatch({ changes: { from: at, insert: ' for the build' } })
    applyFix(view, diagnostic, fix)
    expect(view.state.doc.toString()).toBe(
      'We did it in order for the build to ship.'
    )
  })

  it('applies a fix only once', () => {
    const fix = insertAfter(',')
    const { view, diagnostic } = withIssue('However I agree.', 'However', fix)
    applyFix(view, diagnostic, fix)
    applyFix(view, diagnostic, fix)
    expect(view.state.doc.toString()).toBe('However, I agree.')
  })

  it('leaves a fixed issue out of the current issues', () => {
    const fix = insertAfter(',')
    const { view, diagnostic } = withIssue('However I agree.', 'However', fix)
    applyFix(view, diagnostic, fix)
    expect(currentIssues(view.state)).toEqual([])
  })
})
