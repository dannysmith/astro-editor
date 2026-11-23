/**
 * The app's dev-only `window.__agentBridge` API, which the agent bridge CLI
 * (`bun run app`) calls through the bridge's `/eval` endpoint. It extends the
 * page API (`page.ts`) with app actions. Installed by the `AgentBridge`
 * component; React-side dependencies are passed in so this stays testable.
 */
import type { EditorView } from '@codemirror/view'
import type { QueryClient } from '@tanstack/react-query'
import type { CopyeditChecks, Dialect, Highlights } from '../bindings'
import { getAllCommands } from '../commands/app-commands'
import type { CommandContext } from '../commands/types'
import { getCurrentEditorView } from '../editor/editor-view-ref'
import { readHighlights } from '../editor/extensions/copyedit-mode'
import { readCopyedit } from '../editor/extensions/harper'
import { queryKeys } from '../query-keys'
import type { RightSidebarTab } from '../right-sidebar'
import type { Theme } from '../theme-provider'
import { useEditorStore } from '@/store/editorStore'
import { useGitPanelStore } from '@/store/gitPanelStore'
import { useHarperStore } from '@/store/harperStore'
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

/** The panels, modes and copyedit settings a screenshot depends on */
export interface Scene {
  left: boolean
  right: boolean
  tab: RightSidebarTab
  focus: boolean
  typewriter: boolean
  highlights: Highlights
  checks: CopyeditChecks
  dialect: Dialect
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
      leftSidebar: ui.leftSidebarVisible,
      rightSidebar: {
        visible: ui.rightSidebarVisible,
        tab: ui.rightSidebarTab,
      },
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
      // Closed popups stay mounted, marked data-closed, during their exit animation
      dialogs: [
        ...document.querySelectorAll(
          ':is([role="dialog"], [role="alertdialog"]):not([data-closed])'
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
      await useProjectStore.getState().stopFileWatcher()
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
        const { projectPath, projectSettings } = useProjectStore.getState()
        return (
          projectPath === path &&
          Boolean(projectSettings) &&
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

    /** The current scene, to put back after screenshots. */
    scene(): Scene {
      const ui = useUIStore.getState()
      const { globalSettings } = useProjectStore.getState()
      const { checks, dialect } = readCopyedit(globalSettings)
      return {
        left: ui.leftSidebarVisible,
        right: ui.rightSidebarVisible,
        tab: ui.rightSidebarTab,
        focus: ui.focusModeEnabled,
        typewriter: ui.typewriterModeEnabled,
        highlights: readHighlights(globalSettings),
        checks,
        dialect,
      }
    },

    /** Sets the whole scene and closes overlays, whatever was showing before. */
    async setScene(scene: Scene) {
      useUIStore.setState({
        leftSidebarVisible: scene.left,
        rightSidebarVisible: scene.right,
        rightSidebarTab: scene.tab,
        focusModeEnabled: scene.focus,
        typewriterModeEnabled: scene.typewriter,
        distractionFreeBarsHidden: false,
        projectListOpen: false,
        projectSettingsOpen: false,
        draftFilterByCollection: {},
        collectionViewState: {},
      })
      await useProjectStore.getState().updateGlobalSettings({
        general: { highlights: scene.highlights },
        copyedit: { checks: scene.checks, dialect: scene.dialect },
      })
      await idle()
    },

    /** Waits for Harper to finish checking the open file and find something. */
    async waitForIssues() {
      const found = await waitFor(() => {
        const { status, issues } = useHarperStore.getState()
        return status === 'ready' && issues.length > 0
      }, 20_000)
      if (!found) throw new Error('Harper found no issues in the open file')
      await idle()
    },

    /**
     * Positions the editor's tooltips now. CodeMirror waits for an animation
     * frame, which a hidden window never runs, and its `measure` isn't in its types.
     */
    async measureEditor() {
      const view = getCurrentEditorView() as
        | (EditorView & { measure: () => void })
        | null
      view?.measure()
      await idle()
    },

    /** Turns the open project's Git tab on or off. */
    async setGitPanel(on: boolean) {
      const { projectSettings, updateProjectSettings } =
        useProjectStore.getState()
      if (!projectSettings) throw new Error('No project is open')
      await updateProjectSettings({
        ...projectSettings,
        project: { ...projectSettings.project, gitPanel: on },
      })
      await idle()
    },

    /** Records a file as copied in for the open entry, as dropping it in would. */
    rememberAdded(path: string) {
      const entry = useEditorStore.getState().currentFile?.path
      if (!entry) throw new Error('No file is open in the editor')
      useGitPanelStore.getState().rememberAdded(entry, path)
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
