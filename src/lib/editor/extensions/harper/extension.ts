/**
 * Harper's spelling, grammar and style checks in the editor.
 *
 * Built on `@codemirror/lint`, which runs the check after typing pauses, keeps
 * the issues in editor state (mapped through edits), underlines them and
 * shows a tooltip with their fixes on hover. This adds the Harper source, the
 * styling, and a plugin that publishes the issues to `harperStore` for the
 * Copyedit panel and re-checks when the panel's settings change.
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  forceLinting,
  forEachDiagnostic,
  linter,
  setDiagnosticsEffect,
  type Action,
  type Diagnostic,
} from '@codemirror/lint'
import { StateEffect, type EditorState } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Lint, Linter, Suggestion } from 'harper.js'
import { useHarperStore, type HarperIssue } from '@/store/harperStore'
import { getCurrentEditorView } from '../../editor-view-ref'
import { checkForKind, type HarperCheck } from './checks'
import { getHarper } from './linter'
import { MASK, MASK_PATTERN, proseText } from './prose'

/** The check each diagnostic belongs to, for the panel */
const diagnosticChecks = new WeakMap<Diagnostic, HarperCheck>()

/** harper.js's `SuggestionKind`, which can't be imported without loading harper.js */
const REMOVE = 1
const INSERT_AFTER = 2

/** How many of a lint's suggestions are offered as fixes */
const MAX_SUGGESTIONS = 3

/** Marks a transaction as needing a fresh check, though the document is the same */
const recheckEffect = StateEffect.define()

/**
 * Checks the document again straight away, after a setting changes or an
 * issue is ignored. `forceLinting` alone only hurries a check that's already
 * waiting, so this schedules one first.
 */
function recheck(view: EditorView) {
  view.dispatch({ effects: recheckEffect.of(null) })
  forceLinting(view)
}

async function lintDocument(view: EditorView): Promise<Diagnostic[]> {
  // The lint plugin discards the result if the document changes meanwhile
  const { state } = view
  const { checks } = useHarperStore.getState()
  if (!Object.values(checks).some(Boolean)) return []

  const harper = await getHarper()
  const tree =
    ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state)
  const text = proseText(state.doc.toString(), tree)
  const lints = await harper.lint(text, {
    language: 'plaintext',
    regex_mask: MASK_PATTERN,
  })

  const diagnostics: Diagnostic[] = []
  for (const lint of lints) {
    const check = checkForKind(lint.lint_kind())
    if (!checks[check]) continue
    const { start, end } = lint.span()
    const problem = text.slice(start, end)
    // Issues made by masking: runs of spaces, or words joined across code
    if (!problem.trim() || problem.includes(MASK)) continue

    const diagnostic: Diagnostic = {
      from: start,
      to: end,
      severity: 'info',
      markClass: `cm-harper cm-harper-${check}`,
      source: lint.lint_kind_pretty(),
      message: lint.message(),
      renderMessage: () => renderMessage(lint),
      actions: lintActions(lint, text, harper),
    }
    diagnosticChecks.set(diagnostic, check)
    diagnostics.push(diagnostic)
  }
  return diagnostics
}

/** Harper's message as HTML, which marks the words it quotes as code */
function renderMessage(lint: Lint): Node {
  const template = document.createElement('template')
  template.innerHTML = lint.message_html()
  return template.content
}

function lintActions(lint: Lint, text: string, harper: Linter): Action[] {
  const actions: Action[] = lint
    .suggestions()
    .slice(0, MAX_SUGGESTIONS)
    .map(suggestion => ({
      name: suggestionLabel(suggestion),
      apply: (view, from, to) => applySuggestion(view, suggestion, from, to),
    }))

  if (lint.lint_kind() === 'Spelling') {
    const word = lint.get_problem_text()
    actions.push({
      name: 'Add to Dictionary',
      apply: () => useHarperStore.getState().addWord(word),
    })
  }

  actions.push({
    name: 'Ignore',
    apply: view => {
      void harper.ignoreLint(text, lint).then(() => recheck(view))
    },
  })
  return actions
}

function suggestionLabel(suggestion: Suggestion): string {
  const replacement = suggestion.get_replacement_text()
  switch (Number(suggestion.kind())) {
    case REMOVE:
      return 'Remove'
    case INSERT_AFTER:
      return `Add “${replacement}”`
    default:
      return replacement || 'Remove'
  }
}

function applySuggestion(
  view: EditorView,
  suggestion: Suggestion,
  from: number,
  to: number
) {
  const replacement = suggestion.get_replacement_text()
  const kind = Number(suggestion.kind())
  const change =
    kind === REMOVE
      ? { from, to, insert: '' }
      : kind === INSERT_AFTER
        ? { from: to, insert: replacement }
        : { from, to, insert: replacement }
  view.dispatch({
    changes: change,
    selection: { anchor: change.from + change.insert.length },
    userEvent: 'input',
  })
}

/** The document's diagnostics with their current positions, in document order */
function currentDiagnostics(state: EditorState) {
  const found: { diagnostic: Diagnostic; from: number; to: number }[] = []
  forEachDiagnostic(state, (diagnostic, from, to) =>
    found.push({ diagnostic, from, to })
  )
  return found
}

function publishIssues(state: EditorState) {
  const issues: HarperIssue[] = currentDiagnostics(state).map(
    ({ diagnostic, from, to }) => ({
      check: diagnosticChecks.get(diagnostic) ?? 'grammar',
      kind: diagnostic.source ?? '',
      text: state.sliceDoc(from, to),
      message: diagnostic.message,
      actions: (diagnostic.actions ?? []).map(action => action.name),
    })
  )
  useHarperStore.getState().setIssues(issues)
}

function publishActiveIssue(state: EditorState) {
  const head = state.selection.main.head
  const index = currentDiagnostics(state).findIndex(
    ({ from, to }) => from <= head && head <= to
  )
  const active = index === -1 ? null : index
  if (useHarperStore.getState().activeIssue !== active) {
    useHarperStore.getState().setActiveIssue(active)
  }
}

/** Publishes the issues to the store, and re-checks when the settings change */
const issuesPlugin = ViewPlugin.fromClass(
  class {
    private unsubscribe: () => void

    constructor(view: EditorView) {
      this.unsubscribe = useHarperStore.subscribe((state, previous) => {
        if (
          state.checks !== previous.checks ||
          state.dialect !== previous.dialect ||
          state.words !== previous.words
        ) {
          recheck(view)
        }
      })
    }

    update(update: ViewUpdate) {
      const diagnosticsChanged = update.transactions.some(tr =>
        tr.effects.some(effect => effect.is(setDiagnosticsEffect))
      )
      if (diagnosticsChanged) publishIssues(update.state)
      if (diagnosticsChanged || update.selectionSet || update.docChanged) {
        publishActiveIssue(update.state)
      }
    }

    destroy() {
      this.unsubscribe()
    }
  }
)

/** Selects an issue from the panel by its index, and scrolls it into view */
export function selectIssue(index: number) {
  const view = getCurrentEditorView()
  const issue = view && currentDiagnostics(view.state)[index]
  if (!view || !issue) return
  view.dispatch({
    selection: { anchor: issue.from, head: issue.to },
    effects: EditorView.scrollIntoView(issue.from, { y: 'center' }),
  })
  view.focus()
}

/** Applies one of an issue's fixes from the panel */
export function applyIssueAction(index: number, actionIndex: number) {
  const view = getCurrentEditorView()
  const issue = view && currentDiagnostics(view.state)[index]
  const action = issue?.diagnostic.actions?.[actionIndex]
  if (!view || !issue || !action) return
  action.apply(view, issue.from, issue.to)
  view.focus()
}

/** An issue's underline in its check's colour, softened so it doesn't shout */
const underline = (colour: string) =>
  `color-mix(in oklch, var(--editor-color-${colour}) 60%, transparent)`

const harperTheme = EditorView.theme({
  // Replaces the lint package's own underline, a background image
  '.cm-harper': {
    backgroundImage: 'none',
    paddingBottom: '0',
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '5px',
    textDecorationSkipInk: 'none',
  },
  '.cm-harper-spelling': { textDecorationColor: underline('red') },
  '.cm-harper-grammar': { textDecorationColor: underline('blue') },
  '.cm-harper-style': { textDecorationColor: underline('green') },
  '.cm-lintRange-active': {
    backgroundColor: 'var(--editor-color-selectedtext-background)',
  },
  // The hover tooltip that holds the lint section. Harper's are the editor's
  // only hover tooltips
  '.cm-tooltip.cm-tooltip-hover': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 4px 16px oklch(0 0 0 / 0.12)',
    fontFamily: 'var(--font-ui, -apple-system, sans-serif)',
    fontSize: '13px',
    lineHeight: '1.4',
    maxWidth: '22rem',
    overflow: 'hidden',
  },
  // The kind, then the message, then the fixes
  '.cm-tooltip-lint .cm-diagnostic': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    borderLeft: 'none',
    padding: '8px 10px',
    marginLeft: '0',
  },
  '.cm-tooltip-lint .cm-diagnostic + .cm-diagnostic': {
    borderTop: '1px solid var(--border)',
  },
  // Harper's HTML ends with a newline, which `pre-wrap` would show
  '.cm-diagnosticText': { flexBasis: '100%', whiteSpace: 'normal' },
  '.cm-diagnosticText p': { margin: '0' },
  '.cm-diagnosticText code': {
    fontFamily: 'inherit',
    fontWeight: '600',
  },
  '.cm-diagnosticSource': {
    order: '-1',
    flexBasis: '100%',
    fontSize: '11px',
    color: 'var(--muted-foreground)',
    opacity: '1',
  },
  '.cm-diagnosticAction': {
    backgroundColor: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '1px 6px',
    margin: '0',
    fontSize: '12px',
  },
  '.cm-diagnosticAction:hover': { backgroundColor: 'var(--accent)' },
  '.cm-diagnosticAction u': { textDecoration: 'none' },
})

export function createHarperExtension() {
  return [
    linter(lintDocument, {
      needsRefresh: update =>
        update.transactions.some(tr =>
          tr.effects.some(effect => effect.is(recheckEffect))
        ),
    }),
    issuesPlugin,
    harperTheme,
  ]
}
