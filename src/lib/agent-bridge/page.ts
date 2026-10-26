/**
 * The part of the dev-only `window.__ae` API that works on any page: theme,
 * idle and screenshot helpers, plus finding and driving elements. The app's
 * API (`api.ts`) builds on it; the styleguide uses it as is.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { Theme } from '../theme-provider'
import { keyEventInit } from './keys'
import { buildUiTree, findByText, labelOf, roleOf } from './ui-tree'

export type PageApi = ReturnType<typeof createPageApi>

declare global {
  interface Window {
    __ae?: PageApi
  }
}

/** Identifies an element: a ref from the last `tree`, its label text, or a CSS selector. */
export interface Target {
  ref?: number
  text?: string
  selector?: string
}

export interface PageApiDeps {
  /** Lets `idle` wait for queries to settle */
  queryClient?: QueryClient
  getTheme: () => Theme
  setTheme: (theme: Theme) => void
}

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

// WebKit stops animation frames while the window is hidden behind others, so
// this falls back to a short timeout
const nextFrame = () =>
  Promise.race([
    new Promise(resolve => requestAnimationFrame(resolve)),
    sleep(50),
  ])

/** Polls `check` until it's true. Returns false if it never is within `timeoutMs`. */
export async function waitFor(
  check: () => boolean,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) return false
    await sleep(25)
  }
  return true
}

/**
 * Waits until nothing is loading, jumps animations to their end state, then
 * waits two frames. Animations don't run while the window is hidden, and
 * screenshots want the end state anyway. Gives up waiting after `timeoutMs`.
 */
export async function waitForIdle(queryClient?: QueryClient, timeoutMs = 5000) {
  if (queryClient) {
    await waitFor(
      () => queryClient.isFetching() === 0 && queryClient.isMutating() === 0,
      timeoutMs
    )
  }
  await document.fonts.ready
  // A hidden window doesn't run rendering updates, so force a style recalc to
  // start any pending transitions before finishing them
  void document.documentElement.getBoundingClientRect()
  // Infinite animations (spinners) have no end state, so they're left running
  for (const animation of document.getAnimations()) {
    if (animation.effect?.getComputedTiming().iterations !== Infinity) {
      animation.finish()
    }
  }
  await nextFrame()
  await nextFrame()
}

/**
 * Turns transitions off while screenshots are taken, so colour changes from a
 * theme switch land immediately rather than mid-transition.
 */
export function setShotMode(on: boolean) {
  document.getElementById('agent-bridge-shot-mode')?.remove()
  if (!on) return
  const style = document.createElement('style')
  style.id = 'agent-bridge-shot-mode'
  style.textContent =
    '*, *::before, *::after { transition: none !important; caret-color: transparent !important; }'
  document.head.append(style)
}

export function describe(el: Element): string {
  const label = labelOf(el)
  return `${roleOf(el) ?? el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`
}

export function createPageApi(deps: PageApiDeps) {
  const refs = new Map<number, Element>()
  const idle = (timeoutMs?: number) => waitForIdle(deps.queryClient, timeoutMs)

  function resolve(target: Target): Element {
    let el: Element | null | undefined = null
    if (target.ref !== undefined) {
      el = refs.get(target.ref)
      if (!el?.isConnected) {
        throw new Error(`Ref ${target.ref} is stale. Run tree again`)
      }
    } else if (target.text !== undefined) {
      el = findByText(document.body, target.text)
    } else if (target.selector !== undefined) {
      el = document.querySelector(target.selector)
    }
    if (!el) throw new Error(`Nothing matches ${JSON.stringify(target)}`)
    return el
  }

  return {
    idle,
    shotMode: setShotMode,
    getTheme: () => deps.getTheme(),
    setTheme: (theme: Theme) => deps.setTheme(theme),

    /** The outline described in `ui-tree.ts`. Refs are valid until the next call. */
    tree() {
      return buildUiTree(document.body, refs)
    },

    /** Sends a key combo (e.g. `mod+shift+p`) to the focused element. */
    async key(combo: string) {
      const init = keyEventInit(combo, /Mac/.test(navigator.userAgent))
      const target = document.activeElement ?? document.body
      const handled = !target.dispatchEvent(new KeyboardEvent('keydown', init))
      target.dispatchEvent(new KeyboardEvent('keyup', init))
      await idle()
      return { target: describe(target), handled }
    },

    /** Clicks an element with the pointer and mouse event sequence a real click produces. */
    async click(target: Target) {
      const el = resolve(target)
      const description = describe(el)
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const rect = el.getBoundingClientRect()
      const mouse: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        view: window,
      }
      const pointer: PointerEventInit = {
        ...mouse,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }

      el.dispatchEvent(new PointerEvent('pointerover', pointer))
      el.dispatchEvent(new MouseEvent('mouseover', mouse))
      // A cancelled pointerdown suppresses the compatibility mouse events, as in browsers
      const pointerDown = el.dispatchEvent(
        new PointerEvent('pointerdown', { ...pointer, buttons: 1 })
      )
      if (pointerDown) {
        const mouseDown = el.dispatchEvent(
          new MouseEvent('mousedown', { ...mouse, buttons: 1 })
        )
        if (mouseDown && el instanceof HTMLElement) {
          el.focus({ preventScroll: true })
        }
      }
      el.dispatchEvent(new PointerEvent('pointerup', pointer))
      if (pointerDown) el.dispatchEvent(new MouseEvent('mouseup', mouse))
      el.dispatchEvent(new MouseEvent('click', mouse))
      await idle()
      return description
    },

    /** Sets an input or textarea's value so React sees the change. */
    async fill(target: Target, value: string) {
      const el = resolve(target)
      if (
        !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      ) {
        throw new Error(`${describe(el)} isn't an input or textarea`)
      }
      el.focus({ preventScroll: true })
      // React tracks the value through the prototype setter, not the instance property
      const prototype = Object.getPrototypeOf(el) as
        | HTMLInputElement
        | HTMLTextAreaElement
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await idle()
      return describe(el)
    },
  }
}
