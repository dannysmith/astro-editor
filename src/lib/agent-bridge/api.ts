/**
 * The app's dev-only `window.__agentBridge` API, which the agent bridge CLI
 * (`bun run app`) calls through the bridge's `/eval` endpoint. It extends the
 * page API (`page.ts`) with app actions. Installed by the `AgentBridge`
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
import { createPageApi, waitFor } from './page'
import { labelOf } from './ui-tree'

export interface AgentApiDeps {
  queryClient: QueryClient
  getCommandContext: () => CommandContext
  getTheme: () => Theme
  setTheme: (theme: Theme) => void
  openFileByPath: (path: string) => Promise<void>
}

export function createAgentApi(deps: AgentApiDeps) {
  const page = createPageApi(deps)
  const { idle } = page

  const toasts = () =>
    [...document.querySelectorAll('[data-sonner-toast]')].map(el => labelOf(el))

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
      // Closed overlays can stay mounted briefly for their exit animation
      dialogs: [
        ...document.querySelectorAll(
          ':is([role="dialog"], [role="alertdialog"]):not([data-state="closed"])'
        ),
      ].map(el => labelOf(el)),
      toasts: toasts(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    }
  }

  return {
    ...page,
    state,

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
  }
}
