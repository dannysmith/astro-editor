/**
 * The dev-only `window.__ae` API that the agent bridge CLI (`bun run app`) calls
 * through the bridge's `/eval` endpoint. Installed by the `AgentBridge`
 * component; React-side dependencies are passed in so this stays testable.
 */
import type { QueryClient } from '@tanstack/react-query'
import { getAllCommands } from '../commands/app-commands'
import type { CommandContext } from '../commands/types'
import { getCurrentEditorView } from '../editor/editor-view-ref'
import { queryKeys } from '../query-keys'
import type { Theme } from '../theme-provider'
import { useEditorStore } from '@/store/editorStore'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { keyEventInit } from './keys'
import { buildUiTree, findByText, labelOf, roleOf } from './ui-tree'

export interface AgentApiDeps {
  queryClient: QueryClient
  getCommandContext: () => CommandContext
  getTheme: () => Theme
  setTheme: (theme: Theme) => void
  openFileByPath: (path: string) => Promise<void>
}

/** Identifies an element: a ref from the last `tree`, its label text, or a CSS selector. */
export interface Target {
  ref?: number
  text?: string
  selector?: string
}

export type AgentApi = ReturnType<typeof createAgentApi>

declare global {
  interface Window {
    __ae?: AgentApi
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
// WebKit stops animation frames while the window is hidden behind others, so
// this falls back to a short timeout
const nextFrame = () =>
  Promise.race([
    new Promise(resolve => requestAnimationFrame(resolve)),
    sleep(50),
  ])

/** Polls `check` until it's true. Returns false if it never is within `timeoutMs`. */
async function waitFor(
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

function describe(el: Element): string {
  const label = labelOf(el)
  return `${roleOf(el) ?? el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`
}

export function createAgentApi(deps: AgentApiDeps) {
  const refs = new Map<number, Element>()

  const toasts = () =>
    [...document.querySelectorAll('[data-sonner-toast]')].map(el => labelOf(el))

  /**
   * Waits until nothing is loading, jumps animations to their end state, then
   * waits two frames. Animations don't run while the window is hidden, and
   * screenshots want the end state anyway. Gives up waiting after `timeoutMs`.
   */
  async function idle(timeoutMs = 5000) {
    const { queryClient } = deps
    await waitFor(
      () => queryClient.isFetching() === 0 && queryClient.isMutating() === 0,
      timeoutMs
    )
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

  function state() {
    const { projectPath, selectedCollection } = useProjectStore.getState()
    const { currentFile, isDirty } = useEditorStore.getState()
    const ui = useUIStore.getState()
    const view = getCurrentEditorView()
    const selection = view?.state.selection.main
    return {
      project: projectPath,
      collection: selectedCollection,
      file: currentFile && {
        id: currentFile.id,
        collection: currentFile.collection,
        path: currentFile.path,
      },
      dirty: isDirty,
      sidebar: ui.sidebarVisible,
      frontmatterPanel: ui.frontmatterPanelVisible,
      focusMode: ui.focusModeEnabled,
      typewriterMode: ui.typewriterModeEnabled,
      theme: {
        setting: deps.getTheme(),
        resolved: document.documentElement.classList.contains('dark')
          ? 'dark'
          : 'light',
      },
      editor: view && {
        lines: view.state.doc.lines,
        selection: { from: selection?.from, to: selection?.to },
        focused: view.hasFocus,
      },
      dialogs: [
        ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      ].map(el => labelOf(el)),
      toasts: toasts(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    }
  }

  function resolve(target: Target): Element {
    let el: Element | null | undefined = null
    if (target.ref !== undefined) {
      el = refs.get(target.ref)
      if (!el?.isConnected)
        throw new Error(`Ref ${target.ref} is stale. Run tree again`)
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
    state,

    /** The outline described in `ui-tree.ts`. Refs are valid until the next call. */
    tree() {
      return buildUiTree(document.body, refs)
    },

    getTheme: () => deps.getTheme(),
    setTheme: (theme: Theme) => deps.setTheme(theme),

    /**
     * Turns transitions off while screenshots are taken, so colour changes from a
     * theme switch land immediately rather than mid-transition.
     */
    shotMode(on: boolean) {
      document.getElementById('agent-bridge-shot-mode')?.remove()
      if (!on) return
      const style = document.createElement('style')
      style.id = 'agent-bridge-shot-mode'
      style.textContent =
        '*, *::before, *::after { transition: none !important; caret-color: transparent !important; }'
      document.head.append(style)
    },

    /**
     * Starts the current project from a clean slate after its files were replaced
     * on disk: closes the open file, restarts the watcher and refetches everything.
     */
    async refreshProject() {
      useEditorStore.getState().closeCurrentFile()
      await useProjectStore.getState().startFileWatcher()
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.all })
      await idle()
    },

    /** Opens a project folder (no dialog) and waits for its collections to load. */
    async openProject(path: string) {
      // Straight after a page load the project registry may still be initialising
      const ready = await waitFor(
        () => useProjectStore.getState().globalSettings !== null,
        10_000
      )
      if (!ready) throw new Error("The project registry didn't initialise")
      if (useProjectStore.getState().projectPath !== path) {
        useProjectStore.getState().setProject(path)
      }
      const loaded = await waitFor(() => {
        const { projectPath, currentProjectSettings } =
          useProjectStore.getState()
        return (
          projectPath === path &&
          Boolean(currentProjectSettings) &&
          deps.queryClient.getQueryData(queryKeys.collections(path)) !==
            undefined
        )
      }, 10_000)
      if (!loaded)
        throw new Error(
          `Project didn't load. Toasts: ${JSON.stringify(toasts())}`
        )
      await idle()
      return state()
    },

    /** Opens a file by absolute path, the way deep links do (without focusing the window). */
    async openFile(path: string) {
      await deps.openFileByPath(path)
      const opened = await waitFor(
        () => useEditorStore.getState().currentFile?.path === path,
        5000
      )
      if (!opened)
        throw new Error(`File didn't open. Toasts: ${JSON.stringify(toasts())}`)
      await idle()
      return state()
    },

    commands() {
      return getAllCommands(deps.getCommandContext()).map(c => ({
        id: c.id,
        label: c.label,
      }))
    },

    /** Runs a command palette command by id. */
    async run(id: string) {
      const context = deps.getCommandContext()
      const available = getAllCommands(context)
      const command = available.find(c => c.id === id)
      if (!command) {
        const ids = available.map(c => c.id).join(', ')
        throw new Error(`"${id}" isn't available right now. Available: ${ids}`)
      }
      await command.execute(context)
      await idle()
    },

    /** Inserts text at the editor's cursor as if typed, so auto-save and other listeners run. */
    async type(text: string) {
      const view = getCurrentEditorView()
      if (!view) throw new Error('No file is open in the editor')
      view.focus()
      view.dispatch({
        ...view.state.replaceSelection(text),
        userEvent: 'input.type',
        scrollIntoView: true,
      })
      await idle()
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
        if (mouseDown && el instanceof HTMLElement)
          el.focus({ preventScroll: true })
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
