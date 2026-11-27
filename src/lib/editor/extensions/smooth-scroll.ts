/**
 * Smooth Scroll Extension
 *
 * Animates every scroll the editor makes to bring something into view: the
 * cursor leaving the screen, typewriter mode centring, jumping to a heading,
 * search. Short scrolls feel immediate and long ones take a little longer, but
 * never more than a fraction of a second.
 *
 * HOW IT WORKS:
 * - `EditorView.scrollHandler` hands us each scroll target. We take it over
 *   and move `.cm-scroller` towards it a step per animation frame.
 * - Each step reads where the target is now and covers the share of the
 *   remaining distance the easing curve gives that frame, arriving exactly when
 *   the time is up. Reading it afresh each frame absorbs the changes a long
 *   document goes through on the way: estimated line heights replaced by
 *   measured ones, and CodeMirror moving the scroll position to keep the text
 *   still while that happens.
 * - A long jump moves instantly to a screen away from the target and animates
 *   the rest, so it never draws the whole document on the way.
 * - Scrolling by hand (wheel, trackpad, scrollbar, a click) stops it, and so
 *   does any edit. Loading a file scrolls instantly.
 * - With Reduce Motion on, CodeMirror scrolls as usual, instantly.
 *
 * This relies on `.cm-scroller` being the element that scrolls (see
 * docs/developer/editor.md).
 */

import type { SelectionRange } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { fileLoad } from '../load-document'

/** CodeMirror's `ScrollStrategy`, which it doesn't export */
type ScrollStrategy = 'nearest' | 'start' | 'end' | 'center'

/** How long a scroll of `distance` pixels takes: ~80ms for a line, at most 250ms */
function durationFor(distance: number): number {
  return Math.min(250, 50 + 4 * Math.sqrt(distance))
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
)

interface Animation {
  range: SelectionRange
  y: ScrollStrategy
  yMargin: number
  start: number
  duration: number | null
  eased: number
  settleFrames: number
}

class SmoothScroller {
  private animation: Animation | null = null
  private frame: number | null = null
  /** Set by a file load, whose scroll shouldn't animate from the last file's */
  instant = false

  constructor(private view: EditorView) {}

  update(update: ViewUpdate) {
    if (update.transactions.some(tr => tr.annotation(fileLoad))) {
      // Its scroll, if it has one, comes in the next measure
      this.instant = true
      requestAnimationFrame(() => (this.instant = false))
    }
    // An animation's positions belong to the old document
    if (update.docChanged) this.cancel()
  }

  /** Starts moving towards `range`, from wherever the editor is now */
  scrollIntoView(range: SelectionRange, y: ScrollStrategy, yMargin: number) {
    this.cancel()
    this.animation = {
      range,
      y,
      yMargin,
      start: performance.now(),
      duration: null,
      eased: 0,
      settleFrames: 0,
    }
    this.frame = requestAnimationFrame(this.step)
  }

  // Runs in its own frame callback, outside CodeMirror's measure cycle, so
  // CodeMirror sees each move as an ordinary scroll. Moving the scroll position
  // inside the cycle confuses it: the cycle goes on using the position it read
  // when it started
  private step = () => {
    this.frame = null
    const animation = this.animation
    if (!animation) return
    const { range, y, yMargin } = animation
    const { target, exact } = scrollTargetFor(this.view, range, y, yMargin)
    const scroller = this.view.scrollDOM
    if (animation.duration === null) {
      // Move most of a long jump at once
      const screen = scroller.clientHeight
      if (Math.abs(target - scroller.scrollTop) > screen * 2) {
        scroller.scrollTop =
          target - Math.sign(target - scroller.scrollTop) * screen
      }
      animation.duration = durationFor(Math.abs(target - scroller.scrollTop))
    }

    const t = Math.min(
      1,
      (performance.now() - animation.start) / animation.duration
    )
    const eased = easeOutCubic(t)
    const share = t < 1 ? (eased - animation.eased) / (1 - animation.eased) : 1
    animation.eased = eased
    scroller.scrollTop += (target - scroller.scrollTop) * share
    // Out of time, but if the target was an estimate, settle on it once it's
    // drawn, a few frames at most
    const settling = t === 1 && !exact && animation.settleFrames++ < 5
    if (t < 1 || settling) this.frame = requestAnimationFrame(this.step)
    else this.animation = null
  }

  cancel() {
    this.animation = null
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
  }

  destroy() {
    this.cancel()
  }
}

const smoothScroller = ViewPlugin.fromClass(SmoothScroller, {
  eventHandlers: {
    // Scrolling by hand takes over from an animation
    wheel() {
      this.cancel()
    },
    touchstart() {
      this.cancel()
    },
    mousedown() {
      this.cancel()
    },
  },
})

/** Where a position is on screen: exact if it's drawn, else estimated */
function positionRect(view: EditorView, pos: number, side: -1 | 1) {
  const rect = view.coordsAtPos(pos, side)
  if (rect) return { top: rect.top, bottom: rect.bottom, exact: true }
  const block = view.lineBlockAt(pos)
  const top = view.documentTop + block.top
  return { top, bottom: top + block.height, exact: false }
}

/**
 * Where `.cm-scroller` has to scroll to for `range` to be in view, following
 * CodeMirror's own rules for each strategy. A range taller than the view shows
 * its head's end. `exact` is false when part of the range isn't drawn yet and
 * its position is an estimate
 */
function scrollTargetFor(
  view: EditorView,
  range: SelectionRange,
  y: ScrollStrategy,
  yMargin: number
): { target: number; exact: boolean } {
  const side = range.head < range.anchor ? -1 : 1
  let rect = positionRect(
    view,
    range.head,
    range.assoc || (range.head > range.anchor ? -1 : 1)
  )
  if (!range.empty) {
    const other = positionRect(
      view,
      range.anchor,
      range.anchor > range.head ? -1 : 1
    )
    rect = {
      top: Math.min(rect.top, other.top),
      bottom: Math.max(rect.bottom, other.bottom),
      exact: rect.exact && other.exact,
    }
  }

  const scroller = view.scrollDOM
  const top = scroller.getBoundingClientRect().top
  const height = scroller.clientHeight
  const bottom = top + height
  const rectHeight = rect.bottom - rect.top
  let move = 0
  if (y === 'nearest') {
    if (rect.top < top + yMargin) {
      move = rect.top - (top + yMargin)
      if (side > 0 && rect.bottom > bottom + move) {
        move = rect.bottom - bottom + yMargin
      }
    } else if (rect.bottom > bottom - yMargin) {
      move = rect.bottom - bottom + yMargin
      if (side < 0 && rect.top - move < top) move = rect.top - (top + yMargin)
    }
  } else if (y === 'center' && rectHeight <= height) {
    move = rect.top + rectHeight / 2 - height / 2 - top
  } else if (y === 'start' || (y === 'center' && side < 0)) {
    move = rect.top - yMargin - top
  } else {
    move = rect.bottom - height + yMargin - top
  }
  const max = scroller.scrollHeight - height
  const target = Math.max(0, Math.min(max, scroller.scrollTop + move))
  return { target, exact: rect.exact }
}

/** Creates the smooth scroll extension */
export function createSmoothScrollExtension() {
  return [
    smoothScroller,
    EditorView.scrollHandler.of((view, range, { y, yMargin }) => {
      const scroller = view.plugin(smoothScroller)
      if (!scroller || prefersReducedMotion.matches) return false
      if (scroller.instant) {
        scroller.instant = false
        return false
      }
      scroller.scrollIntoView(range, y, yMargin)
      return true
    }),
  ]
}
