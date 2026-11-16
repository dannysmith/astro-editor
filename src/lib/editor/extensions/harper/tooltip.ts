/**
 * The tooltip for Harper's issues, shown on hover or when an issue is picked
 * in the Copyedit panel: the kind of issue, Harper's message, the suggested
 * fixes as words, and quieter actions to add the word to the dictionary or
 * ignore the issue.
 *
 * `@codemirror/lint` has its own hover tooltip, but its delay is fixed and it
 * can't be opened from code. The extension gives it nothing to show, and this
 * one takes its place.
 */

import { EditorView, activateHover, hoverTooltip } from '@codemirror/view'
import { CHECK_COLOURS } from './checks'
import { addWords } from './settings'
import { applyFix, issuesAt, recheck, type Issue } from './issues'

/** How long the pointer rests on an issue before its tooltip shows, in ms */
const HOVER_TIME = 100

/** Kinds whose message only repeats the word, so it's left out */
const WORD_KINDS = new Set(['Spelling'])

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  node.append(...children)
  return node
}

/** A text button that acts on mousedown, so the editor keeps its selection */
function action(className: string, label: string, run: () => void) {
  const button = element('button', className, label)
  button.type = 'button'
  button.addEventListener('mousedown', event => {
    event.preventDefault()
    run()
  })
  return button
}

function renderIssue(view: EditorView, { diagnostic, details }: Issue) {
  const issue = element('div', 'cm-harper-issue')
  issue.style.setProperty('--harper-colour', CHECK_COLOURS[details.check])
  issue.append(element('div', 'cm-harper-issue-kind', details.kind))

  if (!WORD_KINDS.has(details.kind) || details.fixes.length === 0) {
    issue.append(
      element(
        'div',
        'cm-harper-issue-message',
        diagnostic.renderMessage?.(view) ?? diagnostic.message
      )
    )
  }

  if (details.fixes.length > 0) {
    issue.append(
      element(
        'div',
        'cm-harper-issue-fixes',
        ...details.fixes.map(fix =>
          action('cm-harper-fix', fix.label, () =>
            applyFix(view, diagnostic, fix)
          )
        )
      )
    )
  }

  const { word } = details
  issue.append(
    element(
      'div',
      'cm-harper-issue-actions',
      ...(word
        ? [
            action('cm-harper-action', 'Add to Dictionary', () =>
              addWords([word])
            ),
          ]
        : []),
      action('cm-harper-action', 'Ignore', () => {
        void details.ignore().then(
          () => recheck(view),
          () => undefined
        )
      })
    )
  )
  return issue
}

export const issueTooltip = hoverTooltip(
  (view, pos, side) => {
    const issues = issuesAt(view.state, pos, side)
    if (issues.length === 0) return null
    return {
      pos: Math.min(...issues.map(({ from }) => from)),
      end: Math.max(...issues.map(({ to }) => to)),
      above: true,
      create: () => ({
        dom: element(
          'div',
          'cm-harper-tooltip',
          ...issues.map(issue => renderIssue(view, issue))
        ),
      }),
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

export const tooltipTheme = EditorView.theme({
  // The hover tooltip holding the issue. Harper's are the editor's only
  // hover tooltips
  '.cm-tooltip.cm-tooltip-hover': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 4px 16px var(--editor-color-tooltip-shadow)',
    fontFamily: 'var(--font-ui, -apple-system, sans-serif)',
    fontSize: '13px',
    lineHeight: '1.4',
    width: 'max-content',
    maxWidth: '20rem',
    overflow: 'hidden',
  },
  // The lint package's tooltip still adds an empty section after its own
  // delay. Hidden, it still makes ours the second section, which CodeMirror
  // gives a top border
  '.cm-tooltip-lint:empty': { display: 'none' },
  '.cm-tooltip-section.cm-harper-tooltip': { borderTop: 'none !important' },
  '.cm-harper-issue + .cm-harper-issue': {
    borderTop: '1px solid var(--border)',
  },
  '.cm-harper-issue-kind': {
    padding: '9px 12px 0',
    fontSize: '11px',
    color: 'var(--muted-foreground)',
  },
  '.cm-harper-issue-message': { padding: '4px 12px 0' },
  // Harper's HTML wraps the message in a paragraph and quotes words as code
  '.cm-harper-issue-message p': { margin: '0' },
  '.cm-harper-issue-message code': { fontFamily: 'inherit', fontWeight: '600' },
  // The suggestions, as words in the editor's typeface
  '.cm-harper-issue-fixes': {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: '16px',
    rowGap: '2px',
    padding: '6px 12px 0',
  },
  '.cm-harper-fix': {
    font: 'inherit',
    fontFamily: 'var(--editor-font-family)',
    fontVariationSettings: 'var(--editor-font-variation-settings)',
    fontSize: '15px',
    color: 'var(--popover-foreground)',
    background: 'none',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
  },
  // The likeliest fix first, underlined
  '.cm-harper-fix:first-child': {
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    textUnderlineOffset: '4px',
  },
  '.cm-harper-fix:hover': { color: 'var(--harper-colour)' },
  // Adding to the dictionary and ignoring, quieter and set apart
  '.cm-harper-issue-actions': {
    display: 'flex',
    gap: '14px',
    marginTop: '10px',
    padding: '6px 12px 7px',
    borderTop: '1px solid var(--border)',
  },
  '.cm-harper-action': {
    font: 'inherit',
    fontSize: '12px',
    color: 'var(--muted-foreground)',
    background: 'none',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
  },
  '.cm-harper-action:hover': { color: 'var(--popover-foreground)' },
})
