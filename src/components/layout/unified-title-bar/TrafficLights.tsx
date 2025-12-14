import React, { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { cn } from '../../../lib/utils'

/**
 * macOS-style traffic light window controls (close, minimize, maximize).
 * Handles window focus state to show grey buttons when window is unfocused.
 */
export const TrafficLights: React.FC = () => {
  const [isWindowFocused, setIsWindowFocused] = useState(true)

  const handleMinimize = async () => {
    const window = getCurrentWindow()
    await window.minimize()
  }

  const handleToggleMaximize = async () => {
    const window = getCurrentWindow()
    const isFullscreen = await window.isFullscreen()
    await window.setFullscreen(!isFullscreen)
  }

  const handleClose = async () => {
    const window = getCurrentWindow()
    await window.hide()
  }

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true)
    const handleBlur = () => setIsWindowFocused(false)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return (
    <div
      className={cn(
        'traffic-lights-group mr-3',
        !isWindowFocused && 'window-unfocused'
      )}
    >
      <button
        onClick={() => void handleClose()}
        className="traffic-light traffic-light-close"
      >
        <span className="symbol">&times;</span>
      </button>
      <button
        onClick={() => void handleMinimize()}
        className="traffic-light traffic-light-minimize"
      >
        <span className="symbol">&minus;</span>
      </button>
      <button
        onClick={() => void handleToggleMaximize()}
        className="traffic-light traffic-light-maximize"
      >
        <span className="symbol">&#10530;</span>
      </button>
    </div>
  )
}
