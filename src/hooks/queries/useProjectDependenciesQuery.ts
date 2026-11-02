import { useQuery } from '@tanstack/react-query'
import { commands } from '@/types'
import { queryKeys } from '@/lib/query-keys'

/** The packages in the project's `package.json` */
export function useProjectDependenciesQuery(projectPath: string | null) {
  return useQuery({
    queryKey: queryKeys.projectDependencies(projectPath ?? ''),
    queryFn: async () => {
      const result = await commands.projectDependencies(projectPath!)
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    enabled: !!projectPath,
  })
}
