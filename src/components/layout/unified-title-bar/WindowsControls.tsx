import React from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'

/** Windows-style window controls (minimize, maximize, close). */
export const WindowsControls: React.FC = () => {
  const handleMinimize = async () => {
    const window = getCurrentWindow()
    await window.minimize()
  }

  const handleToggleMaximize = async () => {
    const window = getCurrentWindow()
    const isMaximized = await window.isMaximized()
    if (isMaximized) {
      await window.unmaximize()
    } else {
      await window.maximize()
    }
  }

  const handleClose = async () => {
    const window = getCurrentWindow()
    await window.close()
  }

  return (
    <div className="-my-1.5 -mr-3 flex items-center">
      <button
        onClick={() => void handleMinimize()}
        className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-window-control-hover"
        aria-label="Minimize"
      >
        <Minus className="size-4 text-icon" />
      </button>
      <button
        onClick={() => void handleToggleMaximize()}
        className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-window-control-hover"
        aria-label="Maximize"
      >
        <Square className="size-3.5 text-icon" />
      </button>
      <button
        onClick={() => void handleClose()}
        className="group flex h-11 w-11 items-center justify-center transition-colors hover:bg-window-close hover:text-window-close-foreground"
        aria-label="Close"
      >
        <X className="size-4 text-icon group-hover:text-window-close-foreground" />
      </button>
    </div>
  )
}
