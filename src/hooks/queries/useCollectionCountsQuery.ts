import { useQuery } from '@tanstack/react-query'
import { commands, type Collection } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

/**
 * How many files each of `collections` has, by name. Their folders and
 * patterns are part of the key, so a scan that moves a collection or changes
 * its pattern counts again whatever order queries refetch in, and files being
 * added or removed refresh it with the other file listings (`isFileListing`).
 */
export const useCollectionCountsQuery = (
  projectPath: string | null,
  collections: Collection[]
) =>
  useQuery({
    queryKey: [
      ...queryKeys.collectionCounts(projectPath || ''),
      collections.map(c => [c.name, c.path, c.patterns]),
    ],
    queryFn: async (): Promise<Record<string, number>> => {
      const counts = await Promise.all(
        collections.map(async collection => {
          const result =
            await commands.countCollectionFilesRecursive(collection)
          return [
            collection.name,
            result.status === 'ok' ? result.data : 0,
          ] as const
        })
      )
      return Object.fromEntries(counts)
    },
    enabled: !!projectPath && collections.length > 0,
  })
