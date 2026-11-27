/**
 * Typewriter Mode Extension
 *
 * Keeps the cursor line, or a selection spanning several lines, vertically
 * centred in the editor, as iA Writer's typewriter mode does. The scrolling
 * itself is animated by the smooth scroll extension.
 *
 * HOW IT WORKS:
 * 1. Transaction extender adds EditorView.scrollIntoView(selection, { y: 'center' })
 *    to every transaction that moves the selection or changes the document. This
 *    works WITH CM6's scroll system rather than fighting it.
 * 2. A ViewPlugin toggles a CSS class on .cm-scroller that applies 50vh padding
 *    to .cm-content via CSS. Using vh units avoids JS calculation feedback loops
 *    and automatically responds to viewport changes. It scrolls by however much
 *    the padding changes, so toggling the mode doesn't move the text by itself.
 *    Mouse selections are centred half a second after mouseup, so the scroll
 *    never turns a click into a drag or disturbs a double-click.
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

import {
  StateField,
  StateEffect,
  EditorState,
  type SelectionRange,
} from '@codemirror/state'
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
 * Centres the selection: the cursor's line, or a selection spanning several
 * lines as a block (its head, if it's taller than the editor)
 */
const centreSelection = (range: SelectionRange) =>
  EditorView.scrollIntoView(range, { y: 'center' })

/** How long to wait after a mouse selection ends before centring it */
const POINTER_DELAY = 500

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
    return { effects: centreSelection(tr.state.selection.main) }
  }

  return null
})

/**
 * ViewPlugin that:
 * 1. Toggles a CSS class on .cm-scroller for the 50vh padding
 * 2. Centres a mouse selection once it's done: after mouseup, then a short
 *    pause, so a double-click or a drag isn't disturbed by the scroll, and a
 *    click doesn't move the text from under the pointer straight away
 */
const typewriterPlugin = ViewPlugin.fromClass(
  class {
    /** Cancels the wait for a mouse selection to finish, if there is one */
    private cancelPending: (() => void) | null = null

    constructor(private view: EditorView) {
      this.syncClass()
      // Scrolling by hand during the pause means the reader has moved on
      for (const type of ['wheel', 'touchstart']) {
        view.scrollDOM.addEventListener(type, this.cancel, { passive: true })
      }
    }

    update(update: ViewUpdate) {
      const wasEnabled = update.startState.field(typewriterModeState).enabled
      const isEnabled = update.state.field(typewriterModeState).enabled

      if (wasEnabled !== isEnabled) {
        this.syncClass()
      }
      if (!isEnabled) {
        this.cancel()
        return
      }

      const pointer = update.transactions.some(tr =>
        tr.isUserEvent('select.pointer')
      )
      if (pointer) {
        this.centreAfterPointer()
      } else if (update.selectionSet || update.docChanged) {
        // The keyboard moved on, and the extender centres that straight away
        this.cancel()
      }
    }

    private centreAfterPointer() {
      this.cancel()
      let timer: ReturnType<typeof setTimeout> | undefined
      const onMouseup = () => {
        timer = setTimeout(() => {
          this.cancelPending = null
          this.view.dispatch({
            effects: centreSelection(this.view.state.selection.main),
          })
        }, POINTER_DELAY)
      }
      document.addEventListener('mouseup', onMouseup, { once: true })
      this.cancelPending = () => {
        document.removeEventListener('mouseup', onMouseup)
        clearTimeout(timer)
      }
    }

    private cancel = () => {
      this.cancelPending?.()
      this.cancelPending = null
    }

    // Toggling the padding would move the text by its height, so turning the
    // mode off would leave the centred line at the top. Scrolling by the same
    // amount keeps the text where it is
    syncClass() {
      const enabled = this.view.state.field(typewriterModeState).enabled
      const { contentDOM, scrollDOM } = this.view
      // Read before toggling: removing the padding shrinks the content, which
      // clamps the scroll position
      const scrollTop = scrollDOM.scrollTop
      const paddingBefore = parseFloat(getComputedStyle(contentDOM).paddingTop)
      scrollDOM.classList.toggle('cm-typewriter-active', enabled)
      const shift =
        parseFloat(getComputedStyle(contentDOM).paddingTop) - paddingBefore
      if (shift) scrollDOM.scrollTop = scrollTop + shift
    }

    destroy() {
      this.cancel()
      for (const type of ['wheel', 'touchstart']) {
        this.view.scrollDOM.removeEventListener(type, this.cancel)
      }
      this.view.scrollDOM.classList.remove('cm-typewriter-active')
    }
  }
)

/** Creates the combined typewriter mode extension. */
export function createTypewriterModeExtension() {
  return [typewriterModeState, typewriterScrollExtender, typewriterPlugin]
}
