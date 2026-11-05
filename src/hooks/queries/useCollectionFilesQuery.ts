// src/hooks/queries/useCollectionFilesQuery.ts

import { useQuery } from '@tanstack/react-query'
import { commands, type Collection, type FileEntry } from '@/types'
import { queryKeys } from '@/lib/query-keys'

/**
 * Every entry in a collection, including its subfolders. Files the pattern
 * leaves out aren't entries, so they're never here. Also the Content Finder's
 * queryFn, which shares this cache
 */
export const fetchCollectionFiles = async (
  collection: Collection
): Promise<FileEntry[]> => {
  const result = await commands.scanCollectionFilesRecursive(collection)
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

export const useCollectionFilesQuery = (
  projectPath: string | null,
  collection: Collection | undefined
) => {
  return useQuery({
    queryKey: queryKeys.collectionFiles(
      projectPath || '',
      collection?.name || ''
    ),
    queryFn: () => fetchCollectionFiles(collection!),
    enabled: !!projectPath && !!collection,
  })
}
