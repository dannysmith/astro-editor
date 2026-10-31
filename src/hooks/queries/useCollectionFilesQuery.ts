// src/hooks/queries/useCollectionFilesQuery.ts

import { useQuery } from '@tanstack/react-query'
import { commands, type FileEntry } from '@/types'
import { queryKeys } from '@/lib/query-keys'

/** Every Markdown and MDX file in a collection, including its subfolders */
const fetchCollectionFiles = async (
  collectionPath: string,
  collectionName: string
): Promise<FileEntry[]> => {
  const result = await commands.scanCollectionFilesRecursive(
    collectionPath,
    collectionName
  )
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

export const useCollectionFilesQuery = (
  projectPath: string | null,
  collectionName: string | null,
  collectionPath: string | null
) => {
  return useQuery({
    queryKey: queryKeys.collectionFiles(
      projectPath || '',
      collectionName || ''
    ),
    queryFn: () => fetchCollectionFiles(collectionPath!, collectionName!),
    enabled: !!projectPath && !!collectionName && !!collectionPath,
  })
}
