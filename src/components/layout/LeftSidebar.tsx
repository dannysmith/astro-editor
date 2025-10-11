import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore, type FileEntry } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { useDirectoryScanQuery } from '../../hooks/queries/useDirectoryScanQuery'
import type { Collection } from '../../store'
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

// Type-safe helper functions for file handling
function formatDate(dateValue: unknown): string {
  if (!dateValue) return ''

  try {
    const date = new Date(dateValue as string | number | Date)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function getPublishedDate(
  frontmatter: Record<string, unknown>,
  publishedDateField: string | string[]
): Date | null {
  // Handle both single string and array of field names
  const dateFields = Array.isArray(publishedDateField)
    ? publishedDateField
    : [publishedDateField]

  for (const field of dateFields) {
    const value = frontmatter[field]
    if (value) {
      const date = new Date(value as string)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }
  return null
}

function getTitle(file: FileEntry, titleField: string): string {
  // Use frontmatter title if available, otherwise derive from filename
  if (
    file.frontmatter?.[titleField] &&
    typeof file.frontmatter[titleField] === 'string'
  ) {
    return file.frontmatter[titleField]
  }

  // Extract filename without extension as fallback
  const filename = file.name || file.path.split('/').pop() || 'Untitled'
  return filename.replace(/\.(md|mdx)$/, '')
}

export const LeftSidebar: React.FC = () => {
  const { currentFile, openFile, updateCurrentFileAfterRename } =
    useEditorStore()

  const {
    selectedCollection,
    currentSubdirectory,
    projectPath,
    currentProjectSettings,
    setProject,
    setSelectedCollection,
    setCurrentSubdirectory,
    navigateUp,
  } = useProjectStore()

  // Get current collection's view settings
  const collectionViewSettings =
    currentProjectSettings?.collectionViewSettings?.[selectedCollection || '']
  const showDraftsOnly = collectionViewSettings?.showDraftsOnly || false

  // Use getState() pattern for callbacks to avoid render cascades
  const handleToggleDraftsOnly = useCallback(() => {
    if (selectedCollection) {
      const { updateProjectSettings } = useProjectStore.getState()
      const currentSettings = useProjectStore.getState().currentProjectSettings

      const newSettings = {
        ...currentSettings,
        collectionViewSettings: {
          ...currentSettings?.collectionViewSettings,
          [selectedCollection]: { showDraftsOnly: !showDraftsOnly },
        },
      }

      void updateProjectSettings(newSettings)
    }
  }, [selectedCollection, showDraftsOnly])

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
  const [renameValue, setRenameValue] = React.useState('')
  const renameInitializedRef = React.useRef(false)

  const handleOpenProject = async () => {
    try {
      const result = await invoke<string | null>('select_project_folder')
      if (result) {
        setProject(result)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to open project:', error)
    }
  }

  const handleCollectionClick = (collection: Collection) => {
    setSelectedCollection(collection.name)
    // Files will be automatically fetched by the query
  }

  const handleBackClick = () => {
    navigateUp()
  }

  const handleSubdirectoryClick = (relativePath: string) => {
    setCurrentSubdirectory(relativePath)
  }

  const handleBreadcrumbClick = (subdirectory: string | null) => {
    setCurrentSubdirectory(subdirectory)
  }

  const handleFileClick = (file: FileEntry) => {
    void openFile(file)
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
    // Include extension in the edit value
    const fullName = file.extension
      ? `${file.name}.${file.extension}`
      : file.name
    setRenameValue(fullName || '')
    renameInitializedRef.current = false // Reset for new rename session
  }

  // Focus and select filename without extension when rename input is rendered
  React.useEffect(() => {
    if (renamingFileId && !renameInitializedRef.current) {
      renameInitializedRef.current = true
      const timeoutId = setTimeout(() => {
        const input = document.querySelector(
          'input[type="text"]'
        ) as HTMLInputElement
        if (input && renameValue) {
          input.focus()
          const lastDotIndex = renameValue.lastIndexOf('.')
          if (lastDotIndex > 0) {
            // Select filename without extension
            input.setSelectionRange(0, lastDotIndex)
          } else {
            // Select all if no extension
            input.select()
          }
        }
      }, 10)
      return () => clearTimeout(timeoutId)
    }
  }, [renamingFileId, renameValue])

  const handleRenameSubmit = async (file: FileEntry) => {
    if (!renameValue.trim() || renameValue === file.name) {
      setRenamingFileId(null)
      return
    }

    try {
      const directory = file.path.substring(0, file.path.lastIndexOf('/'))
      const newPath = `${directory}/${renameValue}`

      if (projectPath && selectedCollection) {
        await renameMutation.mutateAsync({
          oldPath: file.path,
          newPath: newPath,
          projectPath,
          collectionName: selectedCollection,
        })

        // Update current file path if this is the current file
        if (currentFile && currentFile.path === file.path) {
          updateCurrentFileAfterRename(newPath)
        }
      }

      setRenamingFileId(null)
      setRenameValue('')

      // Files will be automatically refreshed by the query invalidation
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to rename file:', error)
    }
  }

  const handleRenameCancel = () => {
    setRenamingFileId(null)
    setRenameValue('')
  }

  const handleRenameKeyDown = (event: React.KeyboardEvent, file: FileEntry) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleRenameSubmit(file)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      handleRenameCancel()
    }
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
              onClick={() => void handleOpenProject()}
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
              <span className="text-xs text-[var(--color-draft)] ml-2 font-normal flex-shrink-0">
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
                'size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-muted-foreground flex-shrink-0',
                showDraftsOnly &&
                  'text-[var(--color-draft)] bg-[var(--color-draft-bg)] hover:bg-[var(--color-draft-bg)]/80'
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
                  const title = getTitle(file, frontmatterMappings.title)
                  const publishedDate = getPublishedDate(
                    file.frontmatter || {},
                    frontmatterMappings.publishedDate
                  )
                  const isMdx = file.extension === 'mdx'
                  const isFileDraft =
                    file.isDraft ||
                    file.frontmatter?.[frontmatterMappings.draft] === true
                  const isSelected = currentFile?.id === file.id

                  return (
                    <button
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      onContextMenu={e => void handleContextMenu(e, file)}
                      className={cn(
                        'w-full text-left p-3 rounded-md transition-colors',
                        'hover:bg-accent',
                        isFileDraft &&
                          'bg-[var(--color-warning-bg)] hover:bg-[var(--color-warning-bg)]/80',
                        isSelected && 'bg-primary/15 hover:bg-primary/20'
                      )}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight truncate text-foreground">
                            {title}
                          </div>
                          {publishedDate && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(publishedDate)}
                            </div>
                          )}
                          <div className="text-xs font-mono text-muted-foreground mt-1">
                            {renamingFileId === file.id ? (
                              <input
                                type="text"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => handleRenameKeyDown(e, file)}
                                onBlur={() => void handleRenameSubmit(file)}
                                className="bg-background border border-border rounded px-1 py-0.5 text-xs font-mono w-full text-foreground"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : file.extension ? (
                              `${file.name}.${file.extension}`
                            ) : (
                              file.name
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {isFileDraft && (
                            <Badge
                              variant="destructive"
                              className="text-xs px-1 py-0"
                            >
                              Draft
                            </Badge>
                          )}
                          {isMdx && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1 py-0"
                            >
                              MDX
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
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
