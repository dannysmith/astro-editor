/**
 * Typewriter Mode Extension
 *
 * Keeps the cursor line vertically centred in the editor viewport at all times,
 * mimicking the behaviour of iA Writer's typewriter mode.
 *
 * HOW IT WORKS:
 * 1. Transaction extender adds EditorView.scrollIntoView(pos, { y: 'center' })
 *    to every transaction that moves the cursor or changes the document. This
 *    works WITH CM6's scroll system rather than fighting it.
 * 2. A ViewPlugin toggles a CSS class on .cm-scroller that applies 50vh padding
 *    to .cm-content via CSS. Using vh units avoids JS calculation feedback loops
 *    and automatically responds to viewport changes.
 * 3. State is toggled via the `toggleTypewriterMode` effect.
 *
 * USAGE:
 * Toggle via Cmd+Shift+T or the 'toggleTypewriterMode' command.
 *
 * STYLING:
 * The `.cm-typewriter-active` class is applied to .cm-scroller and styles are
 * defined in src/components/editor/Editor.css.
 *
 * REFERENCES:
 * - CM6 forum: https://discuss.codemirror.net/t/cm6-scroll-to-middle/2924
 * - Obsidian Typewriter Mode plugin (production reference)
 */

import { StateField, StateEffect, EditorState } from '@codemirror/state'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'

/** State effect to toggle typewriter mode on or off. */
export const toggleTypewriterMode = StateEffect.define<boolean>()

/** State field tracking whether typewriter mode is enabled. */
export const typewriterModeState = StateField.define<{ enabled: boolean }>({
  create() {
    return { enabled: false }
  },

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleTypewriterMode)) {
        return { enabled: effect.value }
      }
    }
    return value
  },
})

/**
 * Transaction extender: intercepts every non-pointer transaction that changes
 * the selection or document and adds a center-scroll effect.
 *
 * IMPORTANT: Pointer selections (clicks) are excluded here because scrolling
 * between mousedown and mouseup causes CM6 to interpret the click as a drag,
 * creating a selection instead of placing the cursor. Pointer-initiated centering
 * is handled by the ViewPlugin below, which defers until after the click completes.
 *
 * Triggers on:
 * - tr.docChanged: document edits (typing, paste, delete)
 * - tr.selection (non-pointer): keyboard selection changes (arrow keys, find/replace)
 * - toggleTypewriterMode effect: when mode is toggled on, immediately centre
 */
const typewriterScrollExtender = EditorState.transactionExtender.of(tr => {
  if (!tr.state.field(typewriterModeState).enabled) return null

  // Skip pointer selections - handled by ViewPlugin after click completes
  if (tr.isUserEvent('select.pointer')) return null

  const justEnabled = tr.effects.some(
    e => e.is(toggleTypewriterMode) && e.value
  )

  if (tr.selection || tr.docChanged || justEnabled) {
    return {
      effects: EditorView.scrollIntoView(tr.state.selection.main.head, {
        y: 'center',
      }),
    }
  }

  return null
})

/**
 * ViewPlugin that:
 * 1. Toggles a CSS class on .cm-scroller for the 50vh padding
 * 2. Handles deferred centering for pointer clicks (must wait until after
 *    the click sequence completes to avoid the mousedown/mouseup scroll bug)
 */
const typewriterPlugin = ViewPlugin.fromClass(
  class {
    constructor(private view: EditorView) {
      this.syncClass()
    }

    update(update: ViewUpdate) {
      const wasEnabled = update.startState.field(typewriterModeState).enabled
      const isEnabled = update.state.field(typewriterModeState).enabled

      if (wasEnabled !== isEnabled) {
        this.syncClass()
      }

      // Deferred centering for pointer clicks
      if (
        isEnabled &&
        update.transactions.some(tr => tr.isUserEvent('select.pointer'))
      ) {
        // Use rAF to centre after the click sequence (mouseup) completes
        requestAnimationFrame(() => {
          this.view.dispatch({
            effects: EditorView.scrollIntoView(
              this.view.state.selection.main.head,
              { y: 'center' }
            ),
          })
        })
      }
    }

    syncClass() {
      const enabled = this.view.state.field(typewriterModeState).enabled
      this.view.scrollDOM.classList.toggle('cm-typewriter-active', enabled)
    }

    destroy() {
      this.view.scrollDOM.classList.remove('cm-typewriter-active')
    }
  }
)

/** Creates the combined typewriter mode extension. */
export function createTypewriterModeExtension() {
  return [typewriterModeState, typewriterScrollExtender, typewriterPlugin]
}
