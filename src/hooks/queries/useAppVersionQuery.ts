import { useQuery } from '@tanstack/react-query'
import { commands } from '@/types'
import { queryKeys } from '@/lib/query-keys'

/** The running app's version, e.g. `1.0.20` or `1.0.21-test.3` */
export function useAppVersionQuery() {
  return useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: async () => {
      const result = await commands.getAppVersion()
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    staleTime: Infinity,
  })
}
