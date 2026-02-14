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
 * 2. Padding plugin dynamically sets paddingTop/paddingBottom on .cm-content
 *    to ~50vh so first/last lines can physically reach the centre of the viewport.
 * 3. State is toggled via the `toggleTypewriterMode` effect.
 *
 * USAGE:
 * Toggle via Cmd+Shift+T or the 'toggleTypewriterMode' command.
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
 * Transaction extender: intercepts every transaction that changes the selection
 * or document and adds a center-scroll effect. This works with CM6's own scroll
 * system rather than manually calculating scroll positions.
 *
 * Triggers on:
 * - tr.selection: explicit selection changes (clicks, arrow keys, find/replace)
 * - tr.docChanged: document edits (typing, paste, delete)
 * - toggleTypewriterMode effect: when mode is toggled on, immediately centre
 */
const typewriterScrollExtender = EditorState.transactionExtender.of(tr => {
  if (!tr.state.field(typewriterModeState).enabled) return null

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
 * ViewPlugin that dynamically sets padding on .cm-content so the first and last
 * lines can physically reach the vertical centre of the viewport. Without this,
 * the first line would be stuck at the top and the last at the bottom.
 *
 * When disabled, removes inline styles so the theme CSS takes over.
 */
const typewriterPaddingPlugin = ViewPlugin.fromClass(
  class {
    constructor(private view: EditorView) {
      this.updatePadding()
    }

    update(update: ViewUpdate) {
      const wasEnabled = update.startState.field(typewriterModeState).enabled
      const isEnabled = update.state.field(typewriterModeState).enabled

      if (wasEnabled !== isEnabled || update.geometryChanged) {
        this.updatePadding()
      }
    }

    updatePadding() {
      const enabled = this.view.state.field(typewriterModeState).enabled
      if (enabled) {
        const halfHeight = Math.floor(this.view.scrollDOM.clientHeight / 2)
        this.view.contentDOM.style.paddingTop = `${halfHeight}px`
        this.view.contentDOM.style.paddingBottom = `${halfHeight}px`
      } else {
        // Remove inline styles, let theme CSS take over
        this.view.contentDOM.style.paddingTop = ''
        this.view.contentDOM.style.paddingBottom = ''
      }
    }

    destroy() {
      // Restore theme CSS on cleanup
      this.view.contentDOM.style.paddingTop = ''
      this.view.contentDOM.style.paddingBottom = ''
    }
  }
)

/** Creates the combined typewriter mode extension. */
export function createTypewriterModeExtension() {
  return [typewriterModeState, typewriterScrollExtender, typewriterPaddingPlugin]
}
