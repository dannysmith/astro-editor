import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import { FileEntry } from '@/store'

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
    queryFn: async () => {
      if (!projectPath || !collectionName) {
        return null
      }

      try {
        const files = await invoke<FileEntry[]>('load_file_based_collection', {
          projectPath,
          collectionName,
        })
        return files
      } catch (error) {
        // Collection might not be file-based or doesn't exist
        // eslint-disable-next-line no-console
        console.debug(
          `[FileBasedCollection] Could not load ${collectionName}:`,
          error
        )
        return null
      }
    },
    enabled: !!projectPath && !!collectionName,
    staleTime: 5 * 60 * 1000, // 5 minutes - file-based collections don't change often
  })
}
