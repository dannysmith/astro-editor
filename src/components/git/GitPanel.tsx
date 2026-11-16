import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GitChange } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { toast } from '@/lib/toast'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useGitStateQuery } from '../../hooks/queries/useGitStateQuery'
import { useGitRefresh } from '../../hooks/git/useGitRefresh'
import { useFieldMappings } from '../../hooks/settings'
import { entryChanges, fileName } from '../../lib/git/entry-files'
import { showProjectSettings } from '../../lib/project-settings/actions'
import { GitPanelView } from './GitPanelView'

/**
 * The right sidebar's Git tab, for projects with the experimental Git panel
 * switched on in Project Settings: the branch, the open entry's state and the
 * files that go with it, and the project's other changes.
 */
export const GitPanel: React.FC = () => {
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
  const { data, error, isFetching, isPlaceholderData, refetch } =
    useGitStateQuery(projectPath, currentFile?.path ?? null)
  const { title: titleField } = useFieldMappings(currentFile?.collection)
  const title = useEditorStore(state => {
    const value = titleField ? state.frontmatter[titleField] : undefined
    return typeof value === 'string' && value.trim() ? value : null
  })

  // While another entry's state loads, the last one's is still on screen, so
  // its files aren't grouped with the newly opened entry
  const tree = data?.tree
  const entryPath = (!isPlaceholderData && tree?.entry?.path) || ''
  const changes = tree?.changes ?? []
  // Recomputed as the entry is edited, but it re-renders only when the files
  // it names change (an image dropped in or removed)
  const entryPaths = useEditorStore(
    useShallow(state =>
      entryChanges({
        changes,
        entryPath,
        entryText: entryText(state),
      }).entry.map(change => change.path)
    )
  )

  // What's been ticked or unticked by hand, for this entry. Opening another
  // entry starts again from its own files.
  const [ticks, setTicks] = useState<{
    entry: string
    overrides: Record<string, boolean>
  }>({ entry: entryPath, overrides: {} })
  const overrides = ticks.entry === entryPath ? ticks.overrides : {}

  return (
    <GitPanelView
      state={data}
      error={error?.message}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      title={
        currentFile && !isPlaceholderData
          ? (title ?? fileName(currentFile.path))
          : null
      }
      entryChanges={changes.filter(c => entryPaths.includes(c.path))}
      otherChanges={changes.filter(c => !entryPaths.includes(c.path))}
      isTicked={path => overrides[path] ?? entryPaths.includes(path)}
      onTick={(path, ticked) =>
        setTicks({
          entry: entryPath,
          overrides: { ...overrides, [path]: ticked },
        })
      }
      onOpen={change => void openChange(projectPath, tree?.root, change)}
      onOpenSettings={() => showProjectSettings()}
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
