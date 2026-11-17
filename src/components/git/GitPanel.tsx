import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import type { GitChange } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { toast } from '@/lib/toast'
import { useEditorStore } from '../../store/editorStore'
import { useGitPanelStore } from '../../store/gitPanelStore'
import { useProjectStore } from '../../store/projectStore'
import { useGitStateQuery } from '../../hooks/queries/useGitStateQuery'
import { useGitRefresh } from '../../hooks/git/useGitRefresh'
import { useFieldMappings } from '../../hooks/settings'
import { runGitWrite, type GitWrite } from '../../lib/git/actions'
import { fileName, groupChanges, usedFiles } from '../../lib/git/entry-files'
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
  const { data, error, dataUpdatedAt, isPlaceholderData, refetch } =
    useGitStateQuery(projectPath, currentFile?.path ?? null)

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
  const entryKey = entryPath && tree ? `${tree.root}/${entryPath}` : ''
  const named = useGitPanelStore(state => state.named[entryKey] ?? NONE)
  useEffect(() => {
    if (entryKey && used.length > 0) {
      useGitPanelStore.getState().rememberNamed(entryKey, used)
    }
  }, [entryKey, used])
  // An entry renamed this session: git sees its old path deleted, and that
  // goes with it
  const renamedFrom = useGitPanelStore(state =>
    currentFile ? state.renamedFrom[currentFile.path] : undefined
  )
  const oldPath =
    renamedFrom && tree && renamedFrom.startsWith(`${tree.root}/`)
      ? renamedFrom.slice(tree.root.length + 1)
      : null
  const goesWith =
    oldPath &&
    changes.some(change => change.path === oldPath && change.kind === 'deleted')
      ? [...used, oldPath]
      : used
  const groups = groupChanges({ changes, entryPath, used: goesWith, named })

  const { title: titleField } = useFieldMappings(currentFile?.collection)
  const title = useEditorStore(state => {
    const value = titleField ? state.frontmatter[titleField] : undefined
    return typeof value === 'string' && value.trim() ? value.trim() : null
  })
  const subject = `“${title ?? fileName(entryPath)}”`
  const prefill =
    tree?.entry?.state === 'new' ? `Add ${subject}` : `Update ${subject}`
  // Messages typed for each entry, kept while the project is open so closing
  // the card or opening another entry doesn't lose them. One never edited
  // isn't kept, so it follows the entry's title
  const [messages, setMessages] = useState<Record<string, string>>({})
  const message = messages[entryPath] ?? prefill

  // The files AE staged, and for which entry. The card stays open while
  // they're staged, and folds if git's index is emptied elsewhere
  const [stagedFor, setStagedFor] = useState<{
    entry: string
    paths: string[]
  } | null>(null)
  const ours = stagedFor?.entry === entryPath ? stagedFor.paths : null
  const staging = ours !== null && (tree?.staged.length ?? 0) > 0
  const [committed, setCommitted] = useState<{
    entry: string
    hash: string
  } | null>(null)

  const write = useMutation({
    mutationFn: (write: GitWrite) => runGitWrite(projectPath, write),
    onSuccess: async (hash, write) => {
      if (write.action === 'stage') {
        setStagedFor({ entry: write.entry, paths: write.paths })
        setCommitted(null)
      } else {
        setStagedFor(null)
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
  const forEntry = write.variables?.entry === entryPath

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
      readAt={dataUpdatedAt}
      onRefresh={() => void refetch()}
      entry={
        currentFile && !isPlaceholderData
          ? {
              name: fileName(currentFile.path),
              collection: currentFile.collection,
            }
          : null
      }
      entryChange={groups.entry}
      used={groups.used}
      unused={groups.unused}
      others={groups.others}
      isTicked={path => overrides[path] ?? goesWith.includes(path)}
      onTick={(path, ticked) =>
        setTicks({
          entry: entryPath,
          overrides: { ...overrides, [path]: ticked },
        })
      }
      onOpen={change => void openChange(projectPath, tree?.root, change)}
      onOpenSettings={() => showProjectSettings()}
      commit={{
        staging,
        ourPaths: ours ?? [],
        pending: write.isPending && forEntry ? write.variables.action : null,
        error:
          write.error && forEntry
            ? { action: write.variables.action, message: write.error.message }
            : null,
        committed: committed?.entry === entryPath ? committed.hash : null,
        message,
        onMessageChange: text =>
          setMessages({ ...messages, [entryPath]: text }),
        onStage: paths =>
          write.mutate({ action: 'stage', entry: entryPath, paths }),
        onUnstage: () => {
          if (ours) {
            write.mutate({ action: 'unstage', entry: entryPath, paths: ours })
          }
        },
        onCommit: () => {
          if (ours) {
            write.mutate({
              action: 'commit',
              entry: entryPath,
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

/** Opens a changed content file in the editor */
async function openChange(
  projectPath: string,
  root: string | undefined,
  change: GitChange
) {
  if (!root) return
  const result = await commands.resolveFileEntry(
    `${root}/${change.path}`,
    projectPath
  )
  if (result.status === 'ok' && result.data) {
    useEditorStore.getState().openFile(result.data)
  } else {
    toast.warning("That file isn't in one of the project's collections")
  }
}
