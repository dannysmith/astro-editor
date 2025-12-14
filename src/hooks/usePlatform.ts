import { useState, useEffect } from 'react'
import { platform, type Platform } from '@tauri-apps/plugin-os'

export type AppPlatform = 'macos' | 'windows' | 'linux'

/**
 * Hook to detect the current platform.
 * Returns 'macos', 'windows', or 'linux' (treating all non-macOS/Windows Unix-like systems as linux).
 * Returns undefined during initial render before platform detection completes.
 */
export function usePlatform(): AppPlatform | undefined {
  const [currentPlatform, setCurrentPlatform] = useState<AppPlatform>()

  useEffect(() => {
    const p: Platform = platform()
    if (p === 'macos') {
      setCurrentPlatform('macos')
    } else if (p === 'windows') {
      setCurrentPlatform('windows')
    } else {
      setCurrentPlatform('linux')
    }
  }, [])

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
