import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../ui/command'
import { Badge } from '../ui/badge'
import { useContentLinkerStore } from '../../store/contentLinkerStore'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { getCollectionSettings } from '../../lib/project-registry/collection-settings'
import { commands, type FileEntry } from '@/types'

/**
 * Content Linker Dialog
 * Search all content items and either open or insert a markdown link
 */
export function ContentLinkerDialog() {
  const isOpen = useContentLinkerStore(state => state.isOpen)
  const close = useContentLinkerStore(state => state.close)
  const insertLink = useContentLinkerStore(state => state.insertLink)

  const projectPath = useProjectStore(state => state.projectPath)
  const currentProjectSettings = useProjectStore(
    state => state.currentProjectSettings
  )

  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  const [allFiles, setAllFiles] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Build a lookup from value string -> FileEntry
  const fileMapRef = useRef<Map<string, FileEntry>>(new Map())

  // Fetch all files recursively when dialog opens
  useEffect(() => {
    if (!isOpen || !projectPath || collections.length === 0) {
      return
    }

    let cancelled = false

    const fetchAll = async () => {
      setIsLoading(true)
      const files: FileEntry[] = []

      for (const collection of collections) {
        const result = await commands.scanCollectionFilesRecursive(
          collection.path,
          collection.name
        )
        if (result.status === 'ok') {
          files.push(...result.data)
        }
      }

      if (!cancelled) {
        setAllFiles(files)
        setIsLoading(false)

        // Build value -> file map
        const map = new Map<string, FileEntry>()
        for (const file of files) {
          map.set(buildItemValue(file), file)
        }
        fileMapRef.current = map
      }
    }

    void fetchAll()

    return () => {
      cancelled = true
    }
  }, [isOpen, projectPath, collections])

  // Get the currently highlighted item's value from the DOM
  const getSelectedValue = useCallback((): string | null => {
    const selected = document.querySelector('[cmdk-item][aria-selected="true"]')
    return selected?.getAttribute('data-value') ?? null
  }, [])

  const customFilter = useCallback((value: string, search: string) => {
    const lower = search.toLowerCase()
    if (value.toLowerCase().includes(lower)) {
      return 1
    }
    return 0
  }, [])

  const handleSelect = useCallback(
    (value: string) => {
      const file = fileMapRef.current.get(value)
      if (file) {
        close()
        useEditorStore.getState().openFile(file)
      }
    },
    [close]
  )

  const handleInsertLink = useCallback(() => {
    const value = getSelectedValue()
    if (!value) return

    const file = fileMapRef.current.get(value)
    if (!file) return

    const currentFile = useEditorStore.getState().currentFile
    if (!currentFile) return

    // Get effective settings for the target collection
    const settings = getCollectionSettings(
      currentProjectSettings,
      file.collection
    )

    insertLink(
      file,
      currentFile,
      settings.urlPattern,
      settings.frontmatterMappings.title
    )
  }, [getSelectedValue, insertLink, currentProjectSettings])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        handleInsertLink()
      }
    },
    [handleInsertLink]
  )

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          close()
          setAllFiles([])
          fileMapRef.current = new Map()
        }
      }}
      title="Content Linker"
      description="Search content to open or insert a link"
      filter={customFilter}
    >
      <CommandInput placeholder="Search content..." onKeyDown={handleKeyDown} />
      <CommandList>
        {isLoading ? (
          <CommandEmpty>Loading content...</CommandEmpty>
        ) : allFiles.length === 0 ? (
          <CommandEmpty>No content items found.</CommandEmpty>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {allFiles.map(file => {
                const title = resolveFileTitle(file)
                const value = buildItemValue(file)

                return (
                  <CommandItem
                    key={file.id}
                    value={value}
                    onSelect={() => handleSelect(value)}
                    onKeyDown={handleKeyDown}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{title}</span>
                        {title !== file.name && (
                          <span className="text-xs text-muted-foreground truncate">
                            {file.name}.{file.extension}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {file.collection}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-xs font-mono"
                        >
                          .{file.extension}
                        </Badge>
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint bar */}
      <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex gap-3">
          <span>
            <CommandShortcut>↩</CommandShortcut> Open
          </span>
          <span>
            <CommandShortcut>⌘↩</CommandShortcut> Insert link
          </span>
        </div>
      </div>
    </CommandDialog>
  )
}

function resolveFileTitle(file: FileEntry): string {
  if (file.frontmatter?.title) {
    const val = file.frontmatter.title
    if (typeof val === 'string' && val.length > 0) return val
  }
  return file.name
}

function buildItemValue(file: FileEntry): string {
  const title = resolveFileTitle(file)
  return `${file.collection}:${file.id}:${title}:${file.name}`
}
