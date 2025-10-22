import { QueryClient } from '@tanstack/react-query'

// Create a client with desktop-app-appropriate defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus - this is a desktop app, not a web app
      // File changes will be caught by file watchers or explicit invalidation
      refetchOnWindowFocus: false,

      // Stale time of 5 minutes - data doesn't change frequently in a desktop app
      staleTime: 5 * 60 * 1000,

      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
    },
  },
})
