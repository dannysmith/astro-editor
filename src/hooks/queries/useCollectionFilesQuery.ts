// src/hooks/queries/useCollectionFilesQuery.ts

import { useQuery } from '@tanstack/react-query'
import { commands, type FileEntry } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

const fetchCollectionFiles = async (
  collectionPath: string
): Promise<FileEntry[]> => {
  if (!collectionPath) {
    throw new Error('Collection path is required to fetch files.')
  }
  const result = await commands.scanCollectionFiles(collectionPath)
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
    queryFn: () => fetchCollectionFiles(collectionPath!),
    enabled: !!projectPath && !!collectionName && !!collectionPath,
  })
}
