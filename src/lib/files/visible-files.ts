import type { FileEntry } from '@/types'
import { filterFilesByDraft } from './filtering'
import { filterFilesBySearch } from './search'
import { sortFiles, type FieldMappings, type SortConfig } from './sorting'

/** How the sidebar is showing a collection's files */
export interface FileListView {
  showDraftsOnly: boolean
  searchQuery: string
  sortMode: string
  sortDirection: 'asc' | 'desc'
}

/** The files the sidebar lists for `view`, in its order */
export function visibleFiles(
  files: FileEntry[],
  view: FileListView,
  mappings: FieldMappings,
  defaultSort: SortConfig | null
): FileEntry[] {
  const drafts = filterFilesByDraft(files, view.showDraftsOnly, mappings)
  const found = view.searchQuery
    ? filterFilesBySearch(drafts, view.searchQuery, mappings)
    : drafts
  return sortFiles(
    found,
    { mode: view.sortMode, direction: view.sortDirection },
    mappings,
    defaultSort
  )
}
