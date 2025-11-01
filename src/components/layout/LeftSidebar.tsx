import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { useDirectoryScanQuery } from '../../hooks/queries/useDirectoryScanQuery'
import type { FileEntry, Collection } from '@/types'
import { useRenameFileMutation } from '../../hooks/mutations/useRenameFileMutation'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  FolderOpen,
  ArrowLeft,
  FileText,
  Filter,
  Folder,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileContextMenu } from '../ui/context-menu'
import { useEffectiveSettings } from '../../lib/project-registry/effective-settings'
import { FileItem, getPublishedDate } from './FileItem'
import { openProjectViaDialog } from '../../lib/projects/actions'

export const LeftSidebar: React.FC = () => {
  // Only subscribe to currentFile for selection highlighting
  const currentFile = useEditorStore(state => state.currentFile)

  // Subscribe to project state values that trigger visual updates
  const {
    selectedCollection,
    currentSubdirectory,
    projectPath,
    currentProjectSettings,
  } = useProjectStore()

  // Get current collection's view settings
  const collectionViewSettings =
    currentProjectSettings?.collectionViewSettings?.[selectedCollection || '']
  const showDraftsOnly = collectionViewSettings?.showDraftsOnly || false

  // Use getState() pattern for callbacks to avoid render cascades
  const handleToggleDraftsOnly = useCallback(() => {
    const {
      selectedCollection,
      currentProjectSettings,
      updateProjectSettings,
    } = useProjectStore.getState()

    if (selectedCollection) {
      const showDraftsOnly =
        currentProjectSettings?.collectionViewSettings?.[selectedCollection]
          ?.showDraftsOnly || false

      const newSettings = {
        ...currentProjectSettings,
        collectionViewSettings: {
          ...currentProjectSettings?.collectionViewSettings,
          [selectedCollection]: { showDraftsOnly: !showDraftsOnly },
        },
      }

      void updateProjectSettings(newSettings)
    }
  }, [])

  const [fileCounts, setFileCounts] = useState<Record<string, number>>({})

  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  // Get the current collection
  const currentCollection = collections.find(c => c.name === selectedCollection)

  const {
    data: dirContents,
    refetch: refetchFiles,
    isLoading: isLoadingDirectory,
    isError: hasDirectoryError,
    error: directoryError,
  } = useDirectoryScanQuery(
    projectPath,
    selectedCollection,
    currentCollection?.path || null,
    currentSubdirectory
  )
  // Extract files and subdirectories in useMemo to avoid lint warnings
  const files = React.useMemo(() => dirContents?.files || [], [dirContents])
  const subdirectories = React.useMemo(
    () => dirContents?.subdirectories || [],
    [dirContents]
  )

  const renameMutation = useRenameFileMutation()

  // Load file counts for all collections (recursive)
  useEffect(() => {
    const loadFileCounts = async () => {
      const counts: Record<string, number> = {}

      for (const collection of collections) {
        try {
          const count = await invoke<number>(
            'count_collection_files_recursive',
            {
              collectionPath: collection.path,
            }
          )
          counts[collection.name] = count
        } catch {
          counts[collection.name] = 0
        }
      }

      setFileCounts(counts)
    }

    if (collections.length > 0) {
      void loadFileCounts()
    }
  }, [collections])

  // Get effective settings for frontmatter field mappings (collection-aware)
  const { frontmatterMappings } = useEffectiveSettings(
    selectedCollection || undefined
  )

  // State for rename functionality
  const [renamingFileId, setRenamingFileId] = React.useState<string | null>(
    null
  )

  const handleCollectionClick = (collection: Collection) => {
    useProjectStore.getState().setSelectedCollection(collection.name)
  }

  const handleBackClick = () => {
    useProjectStore.getState().navigateUp()
  }

  const handleSubdirectoryClick = (relativePath: string) => {
    useProjectStore.getState().setCurrentSubdirectory(relativePath)
  }

  const handleBreadcrumbClick = (subdirectory: string | null) => {
    useProjectStore.getState().setCurrentSubdirectory(subdirectory)
  }

  const handleFileClick = (file: FileEntry) => {
    useEditorStore.getState().openFile(file)
  }

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
      onRename: handleRename,
    })
  }

  const handleRename = (file: FileEntry) => {
    setRenamingFileId(file.id)
  }

  const handleRenameSubmit = async (file: FileEntry, newName: string) => {
    if (!newName.trim() || newName === file.name) {
      setRenamingFileId(null)
      return
    }

    try {
      const directory = file.path.substring(0, file.path.lastIndexOf('/'))
      const newPath = `${directory}/${newName}`

      const { projectPath, selectedCollection } = useProjectStore.getState()

      if (projectPath && selectedCollection) {
        await renameMutation.mutateAsync({
          oldPath: file.path,
          newPath: newPath,
          projectPath,
          collectionName: selectedCollection,
        })

        // Update current file path if this is the current file
        const { currentFile, updateCurrentFileAfterRename } =
          useEditorStore.getState()
        if (currentFile && currentFile.path === file.path) {
          updateCurrentFileAfterRename(newPath)
        }
      }

      setRenamingFileId(null)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to rename file:', error)
    }
  }

  const handleRenameCancel = () => {
    setRenamingFileId(null)
  }

  // Filter and sort files by published date (reverse chronological), files without dates first
  const filteredAndSortedFiles = React.useMemo((): FileEntry[] => {
    // Filter files if drafts-only mode is enabled
    let filesToSort = files
    if (showDraftsOnly) {
      filesToSort = files.filter(file => {
        return (
          file.isDraft || file.frontmatter?.[frontmatterMappings.draft] === true
        )
      })
    }

    // Apply existing sorting logic
    return [...filesToSort].sort((a, b) => {
      const dateA = getPublishedDate(
        a.frontmatter || {},
        frontmatterMappings.publishedDate
      )
      const dateB = getPublishedDate(
        b.frontmatter || {},
        frontmatterMappings.publishedDate
      )

      // Files without dates go to top
      if (!dateA && !dateB) return 0
      if (!dateA) return -1
      if (!dateB) return 1

      // Sort by date descending (newest first)
      return dateB.getTime() - dateA.getTime()
    })
  }, [
    files,
    frontmatterMappings.publishedDate,
    frontmatterMappings.draft,
    showDraftsOnly,
  ])

  const headerTitle = selectedCollection
    ? selectedCollection.charAt(0).toUpperCase() + selectedCollection.slice(1)
    : 'Collections'

  // Generate breadcrumb segments
  const breadcrumbSegments = React.useMemo(() => {
    if (!selectedCollection || !currentSubdirectory) return []
    return currentSubdirectory.split('/')
  }, [selectedCollection, currentSubdirectory])

  return (
    <div className="h-full flex flex-col border-r bg-background">
      {/* Header */}
      <div
        className={cn(
          'border-b p-3',
          showDraftsOnly ? 'bg-[var(--color-draft-bg)]' : 'bg-muted/30'
        )}
      >
        <div className="flex items-center gap-2">
          {selectedCollection && (
            <Button
              onClick={handleBackClick}
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground"
              title="Back"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          {!selectedCollection && (
            <Button
              onClick={() => void openProjectViaDialog()}
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground"
              title="Open Project"
            >
              <FolderOpen className="size-4" />
            </Button>
          )}
          <div className="text-sm font-medium text-foreground flex-1 min-w-0 flex items-center gap-1">
            {/* Collection name (always clickable to go to root) */}
            {selectedCollection && currentSubdirectory ? (
              <button
                onClick={() => handleBreadcrumbClick(null)}
                className="hover:underline cursor-pointer truncate"
              >
                {headerTitle}
              </button>
            ) : (
              <span className="truncate">{headerTitle}</span>
            )}

            {/* Breadcrumb segments */}
            {breadcrumbSegments.map((segment, index) => {
              const isLast = index === breadcrumbSegments.length - 1
              const pathUpToSegment = breadcrumbSegments
                .slice(0, index + 1)
                .join('/')

              return (
                <React.Fragment key={pathUpToSegment}>
                  <ChevronRight className="size-3 text-muted-foreground flex-shrink-0" />
                  {isLast ? (
                    <span className="text-muted-foreground truncate">
                      {segment}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBreadcrumbClick(pathUpToSegment)}
                      className="hover:underline cursor-pointer truncate"
                    >
                      {segment}
                    </button>
                  )}
                </React.Fragment>
              )
            })}

            {showDraftsOnly && (
              <span className="text-xs text-[hsl(var(--color-draft))] ml-2 font-normal flex-shrink-0">
                (Drafts)
              </span>
            )}
          </div>
          {selectedCollection && (
            <Button
              onClick={handleToggleDraftsOnly}
              variant="ghost"
              size="sm"
              className={cn(
                'size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 flex-shrink-0',
                showDraftsOnly
                  ? 'text-[hsl(var(--color-draft))] bg-[var(--color-draft-bg)] hover:bg-[var(--color-draft-bg)]/80'
                  : 'text-muted-foreground'
              )}
              title={showDraftsOnly ? 'Show All Files' : 'Show Drafts Only'}
            >
              {showDraftsOnly ? (
                <Filter className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCollection ? (
          // Collections List
          <div className="p-2">
            {collections.map(collection => {
              const fileCount = fileCounts[collection.name] ?? 0

              return (
                <button
                  key={collection.name}
                  onClick={() => handleCollectionClick(collection)}
                  className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-foreground">
                      {collection.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {fileCount} item{fileCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {collection.path.split('/').pop()}
                  </div>
                </button>
              )
            })}
            {collections.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No collections found. Open an Astro project to get started.
              </div>
            )}
          </div>
        ) : (
          // Files List
          <div className="p-2">
            {/* Loading State */}
            {isLoadingDirectory && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Loading directory...
              </div>
            )}

            {/* Error State */}
            {hasDirectoryError && (
              <div className="p-4 text-center">
                <div className="text-sm text-destructive mb-2">
                  Failed to load directory
                </div>
                <div className="text-xs text-muted-foreground mb-3">
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
                {/* Subdirectories (alphabetically sorted) */}
                {subdirectories
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(dir => (
                    <button
                      key={dir.relative_path}
                      onClick={() => handleSubdirectoryClick(dir.relative_path)}
                      className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors flex items-center gap-2 mb-1"
                    >
                      <Folder className="size-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-foreground truncate">
                        {dir.name}
                      </span>
                    </button>
                  ))}

                {/* Files (sorted by date) */}
                {filteredAndSortedFiles.map(file => {
                  const isSelected = currentFile?.id === file.id

                  return (
                    <FileItem
                      key={file.id}
                      file={file}
                      isSelected={isSelected}
                      frontmatterMappings={frontmatterMappings}
                      onFileClick={handleFileClick}
                      onContextMenu={(e, f) => void handleContextMenu(e, f)}
                      onRenameSubmit={handleRenameSubmit}
                      isRenaming={renamingFileId === file.id}
                      onCancelRename={handleRenameCancel}
                    />
                  )
                })}
                {filteredAndSortedFiles.length === 0 &&
                  subdirectories.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {showDraftsOnly
                        ? 'No draft files found in this directory.'
                        : 'This directory is empty.'}
                    </div>
                  )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
