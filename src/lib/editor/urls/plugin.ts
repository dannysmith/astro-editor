/**
 * URL Hover Plugin
 *
 * Provides visual feedback for Alt+Click URL opening. When the Alt key is
 * pressed, URLs in the visible viewport are decorated with a hover class
 * to indicate they're clickable.
 *
 * HOW IT WORKS:
 * 1. altKeyState tracks whether Alt is currently held (updated via altKeyEffect)
 * 2. urlHoverPlugin scans visible text for URLs when Alt is pressed
 * 3. Matching URLs get the 'url-alt-hover' class for visual styling
 * 4. Click handling is done separately in createExtensions.ts via handleUrlClick
 *
 * The Alt key state is managed globally via keydown/keyup listeners in the
 * Layout component, which dispatches altKeyEffect to the editor.
 */

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
} from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import { findUrlsInText } from './detection'

/**
 * State effect for Alt key changes
 */
export const altKeyEffect = StateEffect.define<boolean>()

/**
 * State field to track Alt key state
 */
export const altKeyState = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(altKeyEffect)) {
        return effect.value
      }
    }
    return value
  },
})

/**
 * Plugin that adds hover styling to URLs when Alt key is pressed
 */
export const urlHoverPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.state.field(altKeyState) !== update.startState.field(altKeyState)
      ) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const isAltPressed = view.state.field(altKeyState)
      if (!isAltPressed) return Decoration.none

      const widgets: Array<{ from: number; to: number }> = []

      // Scan through visible lines for URLs
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        const urls = findUrlsInText(text, from)
        widgets.push(...urls)
      }

      // Sort widgets by position before creating decorations - CodeMirror requires sorted ranges
      widgets.sort((a, b) => a.from - b.from)

      return Decoration.set(
        widgets.map(({ from, to }) =>
          Decoration.mark({
            class: 'url-alt-hover',
          }).range(from, to)
        )
      )
    }
  },
  {
    decorations: v => v.decorations,
  }
)
