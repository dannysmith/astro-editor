/**
 * The tooltip for Harper's issues: the kind of issue, Harper's message and
 * the fixes, shown on hover or when an issue is picked in the Copyedit panel.
 *
 * `@codemirror/lint` has its own hover tooltip, but its delay is fixed and it
 * can't be opened from code, so the extension turns it off and uses this one.
 * It's built like lint's, so the same styles apply.
 */

import { forEachDiagnostic, type Diagnostic } from '@codemirror/lint'
import type { EditorState } from '@codemirror/state'
import { activateHover, hoverTooltip, type EditorView } from '@codemirror/view'

/** How long the pointer rests on an issue before its tooltip shows, in ms */
const HOVER_TIME = 100

interface Found {
  diagnostic: Diagnostic
  from: number
  to: number
}

/** The issues at `pos`, on the given side of it */
function issuesAt(state: EditorState, pos: number, side: -1 | 1): Found[] {
  const found: Found[] = []
  forEachDiagnostic(state, (diagnostic, from, to) => {
    const startsBefore = from < pos || (from === pos && side > 0)
    const endsAfter = to > pos || (to === pos && side < 0)
    if (startsBefore && endsAfter) found.push({ diagnostic, from, to })
  })
  return found
}

/** Where a diagnostic is now, after any edits since the check */
function positionOf(state: EditorState, target: Diagnostic) {
  let position: { from: number; to: number } | null = null
  forEachDiagnostic(state, (diagnostic, from, to) => {
    if (diagnostic === target) position = { from, to }
  })
  return position as { from: number; to: number } | null
}

function renderIssue(view: EditorView, diagnostic: Diagnostic): HTMLElement {
  const item = document.createElement('li')
  item.className = `cm-diagnostic cm-diagnostic-${diagnostic.severity}`

  const text = document.createElement('span')
  text.className = 'cm-diagnosticText'
  text.append(diagnostic.renderMessage?.(view) ?? diagnostic.message)
  item.append(text)

  for (const action of diagnostic.actions ?? []) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-diagnosticAction'
    button.textContent = action.name
    // On mousedown, so the editor keeps its focus and selection
    button.addEventListener('mousedown', event => {
      event.preventDefault()
      const position = positionOf(view.state, diagnostic)
      if (position) action.apply(view, position.from, position.to)
    })
    item.append(button)
  }

  if (diagnostic.source) {
    const source = document.createElement('div')
    source.className = 'cm-diagnosticSource'
    source.textContent = diagnostic.source
    item.append(source)
  }
  return item
}

export const issueTooltip = hoverTooltip(
  (view, pos, side) => {
    const found = issuesAt(view.state, pos, side)
    if (found.length === 0) return null
    return {
      pos: Math.min(...found.map(({ from }) => from)),
      end: Math.max(...found.map(({ to }) => to)),
      above: true,
      create: () => {
        const list = document.createElement('ul')
        list.className = 'cm-tooltip-lint cm-tooltip-section'
        list.append(
          ...found.map(({ diagnostic }) => renderIssue(view, diagnostic))
        )
        return { dom: list }
      },
    }
  },
  { hoverTime: HOVER_TIME }
)

/**
 * Opens the tooltip for the issue at `pos`. It stays open until the selection
 * moves or the text changes, such as when a fix is applied.
 */
export function showIssueTooltip(view: EditorView, pos: number) {
  activateHover(view, pos, 1, {
    tooltip: issueTooltip,
    until: tr => tr.docChanged || tr.selection !== undefined,
  })
}
