import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { commands } from '@/lib/bindings'
import { toast } from '@/lib/toast'
import { useEditorStore } from '../../store/editorStore'
import { useGitPanelStore } from '../../store/gitPanelStore'
import { useProjectStore } from '../../store/projectStore'
import { useGitStateQuery } from '../../hooks/queries/useGitStateQuery'
import { useGitRefresh } from '../../hooks/git/useGitRefresh'
import { useFieldMappings } from '../../hooks/settings'
import {
  deleteUnusedFile,
  pullBranch,
  pushBranch,
  runGitWrite,
  type GitWrite,
} from '../../lib/git/actions'
import { showGitFileMenu } from '../../lib/git/context-menu'
import { entryName, groupChanges, usedFiles } from '../../lib/git/entry-files'
import { stagingState } from '../../lib/git/staging'
import { counted } from '../../lib/plural'
import { showProjectSettings } from '../../lib/project-settings/actions'
import { GitPanelView } from './GitPanelView'

/** Stands in for a missing list in selectors, so it's the same each time */
const NONE: string[] = []

/**
 * The right sidebar's Git tab, for projects with the experimental Git panel
 * switched on in Project Settings: the branch, the open entry's state, the
 * files it uses, and the project's other changes.
 */
export const GitPanel = () => {
  const projectPath = useProjectStore(state => state.projectPath)
  if (!projectPath) {
    return (
      <p className="p-4 py-8 text-center text-sm text-muted-foreground">
        No project open.
      </p>
    )
  }
  return <ProjectGitPanel key={projectPath} projectPath={projectPath} />
}

function ProjectGitPanel({ projectPath }: { projectPath: string }) {
  useGitRefresh(projectPath)
  const currentFile = useEditorStore(state => state.currentFile)
  const isLoaded = useEditorStore(state => state.isLoaded)
  const [refreshedAt, setRefreshedAt] = useState(0)
  const { data, error, isPlaceholderData, refetch } = useGitStateQuery(
    projectPath,
    currentFile?.path ?? null
  )

  // While another entry's state loads, the last one's is still on screen, so
  // nothing is grouped with the newly opened entry until it arrives
  const tree = data?.tree
  const entryPath = (!isPlaceholderData && tree?.entry?.path) || ''
  const changes = tree?.changes ?? []
  // Recomputed as the entry is edited, but re-renders only when the files it
  // names change (an image dropped in or taken out)
  const used = useEditorStore(
    useShallow(state =>
      usedFiles({ changes, entryPath, entryText: entryText(state) })
    )
  )
  // An absolute path as git has it, relative to the repository root
  const inRepository = (path: string) =>
    tree && path.startsWith(`${tree.root}/`)
      ? path.slice(tree.root.length + 1)
      : null
  // Files AE copied in for the entry this session, offered with it (unticked)
  // after they're taken out of its text
  const addedForFile = useGitPanelStore(state =>
    currentFile ? (state.added[currentFile.path] ?? NONE) : NONE
  )
  const added = entryPath
    ? addedForFile.flatMap(path => inRepository(path) ?? [])
    : NONE
  // An entry renamed this session: git sees its old path deleted, and that
  // goes with it
  const renamedFrom = useGitPanelStore(state =>
    currentFile ? state.renamedFrom[currentFile.path] : undefined
  )
  const oldPath = renamedFrom ? inRepository(renamedFrom) : null
  const goesWith =
    oldPath &&
    changes.some(change => change.path === oldPath && change.kind === 'deleted')
      ? [...used, oldPath]
      : used
  const groups = groupChanges({ changes, entryPath, used: goesWith, added })

  const { title: titleField } = useFieldMappings(currentFile?.collection)
  const title = useEditorStore(state => {
    const value = titleField ? state.frontmatter[titleField] : undefined
    return typeof value === 'string' && value.trim() ? value.trim() : null
  })
  const subject = `“${title ?? entryName(entryPath)}”`
  const prefill =
    tree?.entry?.state === 'new' ? `Add ${subject}` : `Update ${subject}`
  // Messages typed for each entry, kept while the project is open so closing
  // the card or opening another entry doesn't lose them. One never edited
  // isn't kept, so it follows the entry's title
  // Writes, messages and commits are kept by the entry's path as the editor
  // has it, which AE's renames follow
  const entryFile = currentFile?.path ?? ''
  const [messages, setMessages] = useState<Record<string, string>>({})
  const message = messages[entryFile] ?? prefill

  const staging = useGitPanelStore(state => state.staging)
  const { ours, elsewhere, pullBlocked } = stagingState({
    staging,
    project: projectPath,
    entry: currentFile?.path ?? null,
    tree,
  })
  const [committed, setCommitted] = useState<{
    entry: string
    hash: string
  } | null>(null)
  // The entry whose message should be focused, just after staging it
  const [focusFor, setFocusFor] = useState<string | null>(null)

  const write = useMutation({
    mutationFn: (write: GitWrite) => runGitWrite(projectPath, write),
    onSuccess: async (hash, write) => {
      const { setStaging } = useGitPanelStore.getState()
      if (write.action === 'stage') {
        setStaging({
          project: projectPath,
          entry: write.entry,
          paths: write.paths,
        })
        setCommitted(null)
        setFocusFor(write.entry)
      } else {
        setStaging(null)
      }
      if (write.action === 'commit' && hash) {
        setCommitted({ entry: write.entry, hash })
        setMessages(typed =>
          Object.fromEntries(
            Object.entries(typed).filter(([entry]) => entry !== write.entry)
          )
        )
      }
      // Stays pending until the tab shows what git now has
      await refetch()
    },
  })
  const forEntry = write.variables?.entry === entryFile

  const sync = useMutation({
    mutationFn: async (action: 'push' | 'pull') =>
      action === 'push'
        ? (await pushBranch(projectPath), 0)
        : pullBranch(projectPath),
    onSuccess: async (count, action) => {
      const upstream = tree?.upstream ?? 'the remote'
      if (action === 'push') toast.success(`Pushed to ${upstream}`)
      else if (count === 0) toast.success('Already up to date')
      else toast.success(`Pulled ${counted(count, 'commit')} from ${upstream}`)
      await refetch()
    },
  })

  // What's been ticked or unticked by hand, for this entry. Opening another
  // entry starts again.
  const [ticks, setTicks] = useState<{
    entry: string
    overrides: Record<string, boolean>
  }>({ entry: entryPath, overrides: {} })
  const overrides = ticks.entry === entryPath ? ticks.overrides : {}

  return (
    <GitPanelView
      state={data}
      error={error?.message}
      refreshedAt={refreshedAt}
      onRefresh={() => {
        setRefreshedAt(Date.now())
        void refetch()
      }}
      entry={
        currentFile && !isPlaceholderData
          ? {
              name: entryName(currentFile.path),
              collection: currentFile.collection,
            }
          : null
      }
      entryChange={groups.entry}
      used={groups.used}
      unused={groups.unused}
      renamedFrom={goesWith === used ? null : oldPath}
      onDeleteUnused={path => {
        if (!tree) return
        void deleteUnusedFile(projectPath, `${tree.root}/${path}`).then(
          deleted => {
            if (deleted) void refetch()
          }
        )
      }}
      others={groups.others}
      isTicked={path => overrides[path] ?? goesWith.includes(path)}
      onTick={(path, ticked) =>
        setTicks({
          entry: entryPath,
          overrides: { ...overrides, [path]: ticked },
        })
      }
      onOpen={change => {
        if (tree) void openFileAt(projectPath, `${tree.root}/${change.path}`)
      }}
      onFileMenu={(path, exists, position, deleteItem) => {
        if (tree) {
          void showGitFileMenu(
            `${tree.root}/${path}`,
            exists,
            position,
            deleteItem
          )
        }
      }}
      onOpenSettings={() => showProjectSettings()}
      sync={{
        pending: sync.isPending ? sync.variables : null,
        busy: write.isPending,
        pullBlocked,
        error:
          sync.error && sync.variables
            ? { action: sync.variables, message: sync.error.message }
            : null,
        onPush: () => sync.mutate('push'),
        onPull: () => sync.mutate('pull'),
      }}
      commit={{
        staging: ours !== null,
        ourPaths: ours ?? [],
        // The entry's file under a new name, and files used since staging and
        // not unticked before it
        notStaged: ours
          ? [...(groups.entry ? [groups.entry.path] : []), ...goesWith].filter(
              path => !ours.includes(path) && (overrides[path] ?? true)
            )
          : [],
        entryNotStaged:
          ours !== null &&
          groups.entry !== null &&
          !ours.includes(groups.entry.path),
        pending: write.isPending && forEntry ? write.variables.action : null,
        // Until the editor has the entry's text, the files it uses aren't known
        busy: sync.isPending || (write.isPending && !forEntry) || !isLoaded,
        stagedElsewhere: elsewhere && {
          name: entryName(elsewhere.entry),
          onOpen: () => void openFileAt(projectPath, elsewhere.entry),
          onCancel: () =>
            write.mutate({
              action: 'unstage',
              entry: elsewhere.entry,
              paths: elsewhere.paths,
            }),
        },
        // Cancelling another entry's staging fails here too
        error:
          write.error &&
          (forEntry || write.variables.entry === elsewhere?.entry)
            ? { action: write.variables.action, message: write.error.message }
            : null,
        committed: committed?.entry === entryFile ? committed.hash : null,
        message,
        messageTyped: messages[entryFile] !== undefined,
        focusMessage: focusFor === entryFile,
        onMessageFocused: () => setFocusFor(null),
        onMessageChange: text =>
          setMessages({ ...messages, [entryFile]: text }),
        onStage: paths =>
          write.mutate({ action: 'stage', entry: entryFile, paths }),
        onUnstage: () => {
          if (ours) {
            write.mutate({ action: 'unstage', entry: entryFile, paths: ours })
          }
        },
        onCommit: () => {
          if (ours) {
            write.mutate({
              action: 'commit',
              entry: entryFile,
              paths: ours,
              message: message.trim(),
            })
          }
        },
      }}
    />
  )
}

/** The open entry's text as the editor has it, to look for file names in */
function entryText(state: ReturnType<typeof useEditorStore.getState>): string {
  return JSON.stringify(state.frontmatter) + state.imports + state.editorContent
}

/** Opens a content file (an absolute path) in the editor */
async function openFileAt(projectPath: string, path: string) {
  const result = await commands.resolveFileEntry(path, projectPath)
  if (result.status === 'ok' && result.data) {
    useEditorStore.getState().openFile(result.data)
  } else {
    toast.warning("That file isn't in one of the project's collections")
  }
}
