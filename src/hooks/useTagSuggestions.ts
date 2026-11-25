import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { tagSuggestions, type TagSuggestion } from '../lib/tag-suggestions'
import { useCollectionsQuery } from './queries/useCollectionsQuery'
import { useCollectionFilesQuery } from './queries/useCollectionFilesQuery'

/**
 * The values a list field has in the open file's collection, for its tag
 * input to suggest (see `lib/tag-suggestions.ts`).
 *
 * Listing a collection reads every file in it, and each save that changes
 * frontmatter marks the listing out of date. So it's only fetched while
 * `active` (the input has focus); otherwise every auto-save would re-read the
 * whole collection. Until then it uses the listing if it's cached.
 */
export function useTagSuggestions(
  field: string,
  active: boolean
): TagSuggestion[] {
  const projectPath = useProjectStore(state => state.projectPath)
  const collectionName = useEditorStore(state => state.currentFile?.collection)
  const openPath = useEditorStore(state => state.currentFile?.path)
  const { data: collections = [] } = useCollectionsQuery(projectPath)
  const collection = collections.find(c => c.name === collectionName)
  const { data: entries } = useCollectionFilesQuery(projectPath, collection, {
    enabled: active,
  })
  return entries ? tagSuggestions(entries, field, openPath) : []
}
