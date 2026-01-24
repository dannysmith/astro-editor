/**
 * Focus Mode Extension
 *
 * Provides a distraction-free writing mode that dims all text except the
 * current sentence. As the cursor moves, the "focused" sentence updates
 * and surrounding text is visually dimmed via the `.cm-focus-dimmed` class.
 *
 * HOW IT WORKS:
 * - Tracks cursor position and uses sentence detection to find boundaries
 * - Applies mark decorations to dim text before and after the current sentence
 * - State is toggled via the `toggleFocusMode` effect
 *
 * USAGE:
 * Toggle via Cmd+Shift+F or the 'toggleFocusMode' command.
 *
 * STYLING:
 * The `.cm-focus-dimmed` class is defined in the editor's global CSS
 * (see src/components/editor/editor.css).
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

// State effect to toggle focus mode
export const toggleFocusMode = StateEffect.define<boolean>()

// State field to track focus mode state
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

// Focus mode decorations with simplified approach for better compatibility
export const focusModeDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(decorations: DecorationSet, tr: Transaction) {
    const focusState = tr.state.field(focusModeState)

    if (!focusState.enabled || !focusState.currentSentence) {
      return Decoration.none
    }

    // Performance: Only update if selection changed or document changed
    if (!tr.selection && !tr.docChanged) {
      return decorations.map(tr.changes)
    }

    const marks: Range<Decoration>[] = []
    const doc = tr.state.doc
    const currentSentence = focusState.currentSentence

    // Create decorations for all text except the current sentence
    // We need to handle three cases:
    // 1. Text before the sentence
    // 2. Text after the sentence
    // 3. Text on the same line but outside the sentence

    // Dim everything before the current sentence
    if (currentSentence.from > 0) {
      marks.push(
        Decoration.mark({ class: 'cm-focus-dimmed' }).range(
          0,
          currentSentence.from
        )
      )
    }

    // Dim everything after the current sentence
    if (currentSentence.to < doc.length) {
      marks.push(
        Decoration.mark({ class: 'cm-focus-dimmed' }).range(
          currentSentence.to,
          doc.length
        )
      )
    }

    return Decoration.set(marks, true)
  },

  provide: f => EditorView.decorations.from(f),
})

// Main focus mode plugin
export const focusModePlugin = ViewPlugin.fromClass(
  class {
    constructor(public view: EditorView) {}

    update(_update: ViewUpdate) {
      // Plugin automatically updates via state fields
      // Could add additional logic here if needed
    }
  }
)

// Combined focus mode extension
export function createFocusModeExtension() {
  return [focusModeState, focusModeDecorations, focusModePlugin]
}
