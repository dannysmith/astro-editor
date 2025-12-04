import { useQuery } from '@tanstack/react-query'
import { commands, type MdxComponent } from '@/types'
import { queryKeys } from '@/lib/query-keys'

// Re-export MdxComponent type for consumers
export type { MdxComponent } from '@/types'

export function useMdxComponentsQuery(
  projectPath: string | null,
  mdxDirectory?: string
) {
  return useQuery({
    queryKey: queryKeys.mdxComponents(projectPath || '', mdxDirectory),
    queryFn: async (): Promise<MdxComponent[]> => {
      if (!projectPath) {
        return []
      }

      const result = await commands.scanMdxComponents(
        projectPath,
        mdxDirectory ?? null
      )
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: !!projectPath,
    staleTime: 5 * 60 * 1000, // 5 minutes - MDX components don't change often
  })
}
