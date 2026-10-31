import { useProjectStore } from '../../store/projectStore'
import { astroEntryId } from '../../lib/entry-id'
import { useCollectionsQuery } from './useCollectionsQuery'
import { useCollectionFilesQuery } from './useCollectionFilesQuery'
import { useFileBasedCollectionQuery } from './useFileBasedCollectionQuery'

/** An entry of a collection, as a picker shows it */
export interface EntryOption {
  /** Its id in Astro, which `reference()` and `getEntry()` take */
  value: string
  /** Its title, name or slug, falling back to its id */
  label: string
}

/**
 * A collection's entries with their ids in Astro, for reference fields and the
 * component builder's entry props. Works for collections of files and for
 * file-based ones like `authors.json`.
 */
export function useCollectionEntriesQuery(collectionName: string | undefined) {
  const projectPath = useProjectStore(state => state.projectPath)
  const currentProjectSettings = useProjectStore(
    state => state.currentProjectSettings
  )
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )
  const collection = collections.find(c => c.name === collectionName)

  const { data: regularFiles, isLoading: isLoadingRegular } =
    useCollectionFilesQuery(
      projectPath,
      collectionName ?? '',
      collection?.path ?? null
    )
  // A collection the app doesn't list may be a file-based one
  const { data: fileBasedFiles, isLoading: isLoadingFileBased } =
    useFileBasedCollectionQuery(
      projectPath,
      collection ? null : (collectionName ?? null)
    )

  const files = regularFiles ?? fileBasedFiles ?? []
  const options: EntryOption[] = files.map(file => {
    // A file-based collection's entries use their own `id`, which the app's
    // id has after `<collection>/`
    const id = regularFiles
      ? astroEntryId(file)
      : file.id.slice(file.collection.length + 1)
    // Common display fields in order, not just any string, which could be a
    // description or bio
    const label =
      (file.frontmatter?.title as string | undefined) ||
      (file.frontmatter?.name as string | undefined) ||
      (file.frontmatter?.slug as string | undefined) ||
      id ||
      file.name ||
      'Untitled'
    return { value: id, label }
  })

  return {
    options,
    isLoading: isLoadingRegular || isLoadingFileBased,
    /** Whether there's a collection of that name */
    found: !!collection || !!fileBasedFiles,
  }
}
