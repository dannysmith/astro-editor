import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '../../lib/query-keys'

interface PropInfo {
  name: string
  prop_type: string
  is_optional: boolean
  default_value?: string | null
}

export interface MdxComponent {
  name: string
  file_path: string
  props: PropInfo[]
  has_slot: boolean
  description?: string | null
  framework: 'astro' | 'react' | 'vue' | 'svelte'
}

export function useMdxComponentsQuery(
  projectPath: string | null,
  mdxDirectory?: string
) {
  return useQuery({
    queryKey: queryKeys.mdxComponents(projectPath || '', mdxDirectory),
    queryFn: async () => {
      if (!projectPath) {
        return []
      }

      const components = await invoke<MdxComponent[]>('scan_mdx_components', {
        projectPath,
        mdxDirectory,
      })
      return components
    },
    enabled: !!projectPath,
    staleTime: 5 * 60 * 1000, // 5 minutes - MDX components don't change often
  })
}
