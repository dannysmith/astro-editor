import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

/**
 * Setup function for integration tests that need QueryClient
 * Provides a fresh QueryClient with retry disabled and a wrapper component
 */
export function setupEditorIntegrationTest() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for faster test execution
        gcTime: 0, // Disable cache to ensure fresh data
      },
      mutations: {
        retry: false,
      },
    },
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  // Reset Tauri mocks before each test
  if (globalThis.mockTauri) {
    globalThis.mockTauri.reset()
  }

  return { queryClient, wrapper }
}

/**
 * Simulates continuous typing for integration tests
 * Calls setContent repeatedly with a specified interval
 *
 * @param setContent - Function to set editor content
 * @param durationMs - Total duration to simulate typing (ms)
 * @param intervalMs - Interval between keystrokes (ms)
 */
export async function simulateContinuousTyping(
  setContent: (content: string) => void,
  durationMs: number,
  intervalMs: number
): Promise<void> {
  const iterations = Math.floor(durationMs / intervalMs)

  for (let i = 0; i < iterations; i++) {
    act(() => {
      setContent(`content ${i}`)
    })
    // Use real timers to test actual auto-save timing
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/**
 * Advances fake timers by the specified amount
 * Use this when tests use vi.useFakeTimers()
 */
export function advanceTimersByTime(ms: number): void {
  vi.advanceTimersByTime(ms)
}

/**
 * Waits for a condition to be true, checking at specified intervals
 * Useful for waiting for async operations in integration tests
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait (ms)
 * @param interval - How often to check the condition (ms)
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now()

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Condition not met within ${timeout}ms timeout`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}
