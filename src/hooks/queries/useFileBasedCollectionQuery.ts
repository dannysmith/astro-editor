import { useQuery } from '@tanstack/react-query'
import { commands, type FileEntry } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

/**
 * Query hook for loading file-based collections (JSON loader)
 * These collections are invisible in the UI except for reference dropdowns
 */
export function useFileBasedCollectionQuery(
  projectPath: string | null,
  collectionName: string | null
) {
  return useQuery({
    queryKey: queryKeys.fileBasedCollection(
      projectPath || '',
      collectionName || ''
    ),
    queryFn: async (): Promise<FileEntry[] | null> => {
      if (!projectPath || !collectionName) {
        return null
      }

      const result = await commands.loadFileBasedCollection(
        projectPath,
        collectionName
      )
      if (result.status === 'error') {
        // Collection might not be file-based or doesn't exist
        // eslint-disable-next-line no-console
        console.debug(
          `[FileBasedCollection] Could not load ${collectionName}:`,
          result.error
        )
        return null
      }
      return result.data
    },
    enabled: !!projectPath && !!collectionName,
    staleTime: 5 * 60 * 1000, // 5 minutes - file-based collections don't change often
  })
}
