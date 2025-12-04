import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'

/**
 * Hook to get available IDEs on the current system
 */
export function useAvailableIdes() {
  return useQuery({
    queryKey: ['available-ides'],
    queryFn: async () => {
      const result = await commands.getAvailableIdes()
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - IDEs don't change often
    retry: 1, // Only retry once on failure
  })
}
