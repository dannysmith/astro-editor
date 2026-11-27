/**
 * Focus Mode Extension
 *
 * Provides a distraction-free writing mode that dims all text except the
 * current sentence. As the cursor moves, the "focused" sentence updates.
 *
 * HOW IT WORKS:
 * - Tracks cursor position and uses sentence detection to find boundaries
 * - A `cm-focus-mode` class on the content dims every line. The line holding
 *   the current sentence gets `cm-focus-line`, which keeps it bright, and marks
 *   (`cm-focus-dimmed`) dim the rest of that line outside the sentence
 * - State is toggled via the `toggleFocusMode` effect
 *
 * USAGE:
 * Toggle via Cmd+Shift+F or the 'toggleFocusMode' command.
 *
 * STYLING:
 * The classes are styled in src/components/editor/Editor.css.
 */

import { StateField, StateEffect, Transaction } from '@codemirror/state'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { findCurrentSentence } from '../sentence-detection'

/** State effect to toggle focus mode on or off. Dispatch with `true` to enable, `false` to disable. */
export const toggleFocusMode = StateEffect.define<boolean>()

/** State field tracking whether focus mode is enabled and the current sentence boundaries. */
export const focusModeState = StateField.define<{
  enabled: boolean
  currentSentence: { from: number; to: number } | null
}>({
  create() {
    return { enabled: false, currentSentence: null }
  },

  update(value, tr) {
    let newValue = value

    // Handle focus mode toggle effects
    for (const effect of tr.effects) {
      if (effect.is(toggleFocusMode)) {
        newValue = { ...newValue, enabled: effect.value }
        // If enabling focus mode, immediately set the current sentence
        if (effect.value) {
          const currentSentence = findCurrentSentence(
            tr.state,
            tr.state.selection.main.head
          )
          newValue = { ...newValue, currentSentence }
        }
      }
    }

    // Update current sentence if cursor moved or focus mode is enabled
    if ((tr.selection || tr.docChanged) && newValue.enabled) {
      const currentSentence = findCurrentSentence(
        tr.state,
        tr.state.selection.main.head
      )
      newValue = { ...newValue, currentSentence }
    }

    return newValue
  },
})

const focusLine = Decoration.line({ class: 'cm-focus-line' })
const dimmed = Decoration.mark({ class: 'cm-focus-dimmed' })

/**
 * Decorations for the line holding the current sentence: it's kept bright,
 * while every other line is dimmed by the `cm-focus-mode` class on the
 * content, and the rest of it outside the sentence is dimmed with marks.
 *
 * Only this line is ever decorated. Marks across the whole document made
 * CodeMirror redraw every visible line whenever the dimming appeared or went,
 * and while it did, the content was briefly short enough for the browser to
 * clamp the scroll position, so the view jumped.
 */
export const focusModeDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(decorations: DecorationSet, tr: Transaction) {
    const focus = tr.state.field(focusModeState)
    if (!focus.enabled || !focus.currentSentence) return Decoration.none
    if (focus === tr.startState.field(focusModeState)) {
      return decorations.map(tr.changes)
    }

    // A sentence is always within one line
    const { from, to } = focus.currentSentence
    const line = tr.state.doc.lineAt(from)
    const ranges: Range<Decoration>[] = [focusLine.range(line.from)]
    if (from > line.from) ranges.push(dimmed.range(line.from, from))
    if (to < line.to) ranges.push(dimmed.range(to, line.to))
    return Decoration.set(ranges, true)
  },

  // Provided as a function, which CodeMirror treats as styling only. Provided
  // directly, it re-estimates the heights of the lines it changes on
  provide: f => EditorView.decorations.of(view => view.state.field(f)),
})

/** Dims every line while focus mode is on (see `focusModeDecorations`) */
const focusModeClass = EditorView.contentAttributes.from(
  focusModeState,
  (focus): Record<string, string> =>
    focus.enabled ? { class: 'cm-focus-mode' } : {}
)

/** ViewPlugin that coordinates focus mode updates. State changes are handled by the state fields. */
export const focusModePlugin = ViewPlugin.fromClass(
  class {
    constructor(public view: EditorView) {}

    update(_update: ViewUpdate) {
      // Plugin automatically updates via state fields
      // Could add additional logic here if needed
    }
  }
)

/** Creates the combined focus mode extension. Include this in your editor's extensions array. */
export function createFocusModeExtension() {
  return [focusModeState, focusModeDecorations, focusModeClass, focusModePlugin]
}
