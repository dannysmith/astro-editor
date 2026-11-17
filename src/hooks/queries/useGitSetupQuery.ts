import { useQuery } from '@tanstack/react-query'
import { homeDir } from '@tauri-apps/api/path'
import { commands } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

async function fetchGitSetup(projectPath: string) {
  const [result, home] = await Promise.all([
    commands.gitSetup(projectPath),
    homeDir().catch(() => null),
  ])
  if (result.status === 'error') throw new Error(result.error)
  return { setup: result.data, home }
}

/**
 * What git looks like for the project, with the home folder for showing paths.
 * Only runs git while `enabled` (the Git panel setting is on).
 */
export function useGitSetupQuery(projectPath: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.gitSetup(projectPath),
    queryFn: () => fetchGitSetup(projectPath),
    enabled,
    staleTime: 0,
  })
}
