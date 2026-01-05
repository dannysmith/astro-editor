import { useState } from 'react'
import { platform, type Platform } from '@tauri-apps/plugin-os'

export type AppPlatform = 'macos' | 'windows' | 'linux'

// Debug: Set to 'windows' or 'linux' to test title bars on macOS
// TODO: Remove before shipping - search for DEBUG_PLATFORM_OVERRIDE
const DEBUG_PLATFORM_OVERRIDE: AppPlatform | null = 'windows'

/**
 * Hook to detect the current platform.
 * Returns 'macos', 'windows', or 'linux' (treating all non-macOS/Windows Unix-like systems as linux).
 * Returns undefined if platform detection fails (e.g., in tests or SSR).
 */
export function usePlatform(): AppPlatform | undefined {
  // Platform never changes during the app lifecycle, so compute once on mount
  // using lazy state initialization to avoid effects
  const [currentPlatform] = useState<AppPlatform | undefined>(() => {
    // Debug override for testing platform-specific UI
    if (DEBUG_PLATFORM_OVERRIDE) return DEBUG_PLATFORM_OVERRIDE

    try {
      const p: Platform = platform()
      if (p === 'macos') return 'macos'
      if (p === 'windows') return 'windows'
      return 'linux'
    } catch {
      // Handle case where Tauri isn't ready (SSR, tests, etc.)
      return undefined
    }
  })

  return currentPlatform
}

/**
 * Get the platform synchronously.
 * Use this in non-React contexts or when you need the platform immediately.
 * Note: On server-side rendering or before Tauri is ready, this may throw.
 */
export function getPlatform(): AppPlatform {
  const p: Platform = platform()
  if (p === 'macos') return 'macos'
  if (p === 'windows') return 'windows'
  return 'linux'
}
