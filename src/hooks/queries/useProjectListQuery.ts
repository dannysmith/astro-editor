import { useQuery } from '@tanstack/react-query'
import { homeDir } from '@tauri-apps/api/path'
import { commands } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

async function fetchProjectList() {
  const [result, home] = await Promise.all([
    commands.listProjects(),
    homeDir().catch(() => null),
  ])
  if (result.status === 'error') throw new Error(result.error)
  return { projects: result.data, home }
}

/**
 * Every registered project, most recently opened first, with whether its folder
 * is still there, and the home folder for showing paths. Read afresh each time
 * the list opens, since that's when AE checks for missing projects.
 */
export function useProjectListQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projectList,
    queryFn: fetchProjectList,
    enabled,
    staleTime: 0,
  })
}
