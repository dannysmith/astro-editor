import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

/**
 * What the Git tab shows: the branch, the project's changes, and the state of
 * the entry at `entryPath`. Always read afresh when asked (git changes in other
 * apps); `useGitRefresh` says when. Keeps the last answer on screen while the
 * next one loads, so opening another entry doesn't flash.
 */
export function useGitStateQuery(
  projectPath: string,
  entryPath: string | null
) {
  return useQuery({
    queryKey: queryKeys.gitState(projectPath, entryPath),
    queryFn: async () => {
      const result = await commands.gitState(projectPath, entryPath)
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}
