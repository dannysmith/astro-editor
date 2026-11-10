import { useQuery } from '@tanstack/react-query'
import { commands, type MdxComponent } from '@/types'
import { queryKeys } from '@/lib/query-keys'

// Re-export MdxComponent type for consumers
export type { MdxComponent } from '@/types'

/** The components in the project's MDX components folders, once they're known */
export function useMdxComponentsQuery(
  projectPath: string | null,
  mdxDirectories: string[] | undefined
) {
  return useQuery({
    queryKey: queryKeys.mdxComponents(projectPath || '', mdxDirectories ?? []),
    queryFn: async (): Promise<MdxComponent[]> => {
      const result = await commands.scanMdxComponents(
        projectPath!,
        mdxDirectories!
      )
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: !!projectPath && !!mdxDirectories,
    staleTime: 5 * 60 * 1000, // 5 minutes - MDX components don't change often
  })
}
