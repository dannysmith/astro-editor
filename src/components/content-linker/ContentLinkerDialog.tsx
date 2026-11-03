import { useQueries } from '@tanstack/react-query'
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
import { resolveTitle } from '../../lib/content-linker'
import { type FileEntry, type Collection } from '@/types'
import { queryKeys } from '../../lib/query-keys'
import { fetchCollectionFiles } from '../../hooks/queries/useCollectionFilesQuery'
import { usePlatform } from '../../hooks/usePlatform'

const EMPTY_COLLECTIONS: Collection[] = []

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

  const { data: collections = EMPTY_COLLECTIONS } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  const platform = usePlatform()
  const modKey = platform === 'macos' || platform === undefined ? '⌘' : 'Ctrl+'

  // Every collection's files, from the cache the entry pickers also use, so
  // saves and outside changes keep it current (see useFileChangeHandler).
  // A collection that fails to scan is left out
  const fileQueries = useQueries({
    queries: collections.map(collection => ({
      queryKey: queryKeys.collectionFiles(projectPath || '', collection.name),
      queryFn: () => fetchCollectionFiles(collection.path, collection.name),
      enabled: isOpen && !!projectPath,
      retry: false,
    })),
  })
  const hasFetched = fileQueries.every(query => !query.isPending)
  const allFiles = fileQueries.flatMap(query => query.data ?? [])

  // Item value -> file, for the filter and the handlers
  const fileMap = new Map(allFiles.map(file => [buildItemValue(file), file]))

  // Get the currently highlighted item's value from the DOM.
  // Uses cmdk's internal [cmdk-item][aria-selected] attributes —
  // this is the recommended way to read selection state when cmdk
  // doesn't expose it via a callback prop.
  const getSelectedValue = (): string | null => {
    const selected = document.querySelector('[cmdk-item][aria-selected="true"]')
    return selected?.getAttribute('data-value') ?? null
  }

  const customFilter = (value: string, search: string) => {
    const lower = search.toLowerCase()
    // value is file.path — also search against title, collection, and file name
    const file = fileMap.get(value)
    if (file) {
      const title = resolveTitle(file)
      if (
        title.toLowerCase().includes(lower) ||
        file.collection.toLowerCase().includes(lower) ||
        file.name.toLowerCase().includes(lower) ||
        value.toLowerCase().includes(lower)
      ) {
        return 1
      }
    }
    return 0
  }

  const handleSelect = (value: string) => {
    const file = fileMap.get(value)
    if (file) {
      close()
      useEditorStore.getState().openFile(file)
    }
  }

  const handleInsertLink = () => {
    const value = getSelectedValue()
    if (!value) return

    const file = fileMap.get(value)
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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      handleInsertLink()
    }
  }

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) close()
      }}
      title="Content Linker"
      description="Search content to open or insert a link"
      filter={customFilter}
    >
      <CommandInput placeholder="Search content..." onKeyDown={handleKeyDown} />
      <CommandList className="min-h-[300px]">
        {!hasFetched ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading content...
          </div>
        ) : allFiles.length === 0 ? (
          <CommandEmpty>No content items found.</CommandEmpty>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {allFiles.map(file => {
                const title = resolveTitle(file)
                const value = buildItemValue(file)

                return (
                  <CommandItem
                    key={value}
                    value={value}
                    onSelect={() => handleSelect(value)}
                    className="cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{title}</span>
                        {title !== file.name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {file.name}.{file.extension}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">
                          {file.collection}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
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
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex gap-3">
          <span>
            <CommandShortcut>↩</CommandShortcut> Open
          </span>
          <span>
            <CommandShortcut>{modKey}↩</CommandShortcut> Insert link
          </span>
        </div>
      </div>
    </CommandDialog>
  )
}

function buildItemValue(file: FileEntry): string {
  return file.path
}
