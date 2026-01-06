import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useUIStore } from '../store/uiStore'
import { usePlatform } from './usePlatform'

/**
 * Manages square corners based on platform and fullscreen state.
 *
 * Rules:
 * - macOS: always rounded (never square)
 * - Windows: square only when fullscreen
 * - Linux: square only when fullscreen
 */
export function useSquareCornersEffect() {
  const platform = usePlatform()
  const setSquareCorners = useUIStore(state => state.setSquareCorners)

  useEffect(() => {
    // macOS always has rounded corners, undefined means not ready yet
    if (platform === 'macos' || platform === undefined) {
      setSquareCorners(false)
      return
    }

    const window = getCurrentWindow()

    const updateCorners = async () => {
      const isFullscreen = await window.isFullscreen()
      // Windows/Linux: square corners only in fullscreen
      setSquareCorners(isFullscreen)
    }

    // Check initial state
    void updateCorners()

    // Listen for window state changes
    const unlisten = window.onResized(() => {
      void updateCorners()
    })

    return () => {
      void unlisten.then(fn => fn())
    }
  }, [platform, setSquareCorners])
}
