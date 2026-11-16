import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

/**
 * The colour themes in the app data folder's `themes/` folder, as CSS. Read
 * again each time the window regains focus (`useColourTheme`).
 */
export function useColourThemesQuery() {
  return useQuery({
    queryKey: queryKeys.colourThemes,
    queryFn: async () => {
      const result = await commands.listColourThemes()
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    staleTime: Infinity,
  })
}
