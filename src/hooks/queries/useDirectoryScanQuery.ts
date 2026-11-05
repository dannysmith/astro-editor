// src/hooks/queries/useDirectoryScanQuery.ts

import { useQuery } from '@tanstack/react-query'
import { commands, type Collection, type DirectoryScanResult } from '@/types'
import { queryKeys } from '@/lib/query-keys'

const fetchDirectoryContents = async (
  directoryPath: string,
  collection: Collection
): Promise<DirectoryScanResult> => {
  const result = await commands.scanDirectory(directoryPath, collection)
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

/**
 * One folder of a collection: its subfolders and files, as the collection's
 * pattern and skipped files setting decide
 */
export const useDirectoryScanQuery = (
  projectPath: string | null,
  collection: Collection | undefined,
  subdirectory: string | null // Relative path from the collection folder
) => {
  return useQuery({
    queryKey: queryKeys.directoryContents(
      projectPath || '',
      collection?.name || '',
      subdirectory || 'root'
    ),
    queryFn: () => {
      const fullPath = subdirectory
        ? `${collection!.path}/${subdirectory}`
        : collection!.path
      return fetchDirectoryContents(fullPath, collection!)
    },
    enabled: !!projectPath && !!collection,
  })
}
