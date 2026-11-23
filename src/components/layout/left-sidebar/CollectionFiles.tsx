import React from 'react'
import { Folder } from 'lucide-react'
import type { FileEntry } from '@/types'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { useCollectionsQuery } from '../../../hooks/queries/useCollectionsQuery'
import { useDirectoryScanQuery } from '../../../hooks/queries/useDirectoryScanQuery'
import { useFieldMappings } from '../../../hooks/settings'
import { useCollectionView } from '../../../hooks/useCollectionView'
import { useFileRename } from '../../../hooks/useFileRename'
import { visibleFiles } from '../../../lib/files/visible-files'
import { Button } from '../../ui/button'
import { FileContextMenu } from '../../ui/context-menu'
import { FileItem } from './FileItem'

/** The folders and files at the current place in a collection */
export const CollectionFiles: React.FC<{ collectionName: string }> = ({
  collectionName,
}) => {
  const currentFilePath = useEditorStore(state => state.currentFile?.path)
  const currentSubdirectory = useProjectStore(
    state => state.currentSubdirectory
  )
  const projectPath = useProjectStore(state => state.projectPath)
  const { showDraftsOnly, searchQuery, sortMode, sortDirection } =
    useCollectionView(collectionName)

  const { data: collections = [] } = useCollectionsQuery(projectPath)
  const collection = collections.find(c => c.name === collectionName)
  const {
    data: dirContents,
    refetch: refetchFiles,
    isLoading: isLoadingDirectory,
    isError: hasDirectoryError,
    error: directoryError,
  } = useDirectoryScanQuery(projectPath, collection, currentSubdirectory)

  // The collection's title, date and draft fields
  const frontmatterMappings = useFieldMappings(collectionName)
  const { renamingPath, startRename, cancelRename, submitRename } =
    useFileRename()

  // Alphabetically, on a copy: this is the query's cached data
  const subdirectories = [...(dirContents?.subdirectories ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const files = visibleFiles(
    dirContents?.files ?? [],
    { showDraftsOnly, searchQuery, sortMode, sortDirection },
    frontmatterMappings,
    collection?.settings.defaultSort.value ?? null
  )

  const handleContextMenu = async (
    event: React.MouseEvent,
    file: FileEntry
  ) => {
    event.preventDefault()
    event.stopPropagation()

    await FileContextMenu.show({
      file,
      position: { x: event.clientX, y: event.clientY },
      onRefresh: () => {
        void refetchFiles()
      },
      onRename: startRename,
    })
  }

  return (
    <div className="p-2">
      {/* Loading State */}
      {isLoadingDirectory && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Loading directory...
        </div>
      )}

      {/* Error State */}
      {hasDirectoryError && (
        <div className="p-4 text-center">
          <div className="mb-2 text-sm text-destructive">
            Failed to load directory
          </div>
          <div className="mb-3 text-xs break-words text-muted-foreground">
            {directoryError instanceof Error
              ? directoryError.message
              : 'Unknown error occurred'}
          </div>
          <Button
            onClick={() => void refetchFiles()}
            variant="outline"
            size="sm"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Content (only show if not loading and no error) */}
      {!isLoadingDirectory && !hasDirectoryError && (
        <>
          {subdirectories.map(dir => (
            <button
              key={dir.relative_path}
              onClick={() =>
                useProjectStore
                  .getState()
                  .setCurrentSubdirectory(dir.relative_path)
              }
              className="mb-1 flex w-full items-center gap-2 rounded-md p-3 text-left transition-colors hover:bg-accent"
            >
              <Folder className="size-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-foreground">
                {dir.name}
              </span>
            </button>
          ))}

          {/* Files, in the chosen sort order */}
          {files.map(file => (
            <FileItem
              key={file.path}
              file={file}
              isSelected={currentFilePath === file.path}
              frontmatterMappings={frontmatterMappings}
              onFileClick={f => useEditorStore.getState().openFile(f)}
              onContextMenu={(e, f) => void handleContextMenu(e, f)}
              onRenameSubmit={submitRename}
              isRenaming={renamingPath === file.path}
              onCancelRename={cancelRename}
            />
          ))}
          {files.length === 0 && subdirectories.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery
                ? 'No files match your search.'
                : showDraftsOnly
                  ? 'No draft files found in this directory.'
                  : 'This directory is empty.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
