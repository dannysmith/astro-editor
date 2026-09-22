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
    <div className="flex items-center -my-1.5 -mr-3">
      <button
        onClick={() => void handleMinimize()}
        className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="Minimize"
      >
        <Minus className="size-4" />
      </button>
      <button
        onClick={() => void handleToggleMaximize()}
        className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="Maximize"
      >
        <Square className="size-3.5" />
      </button>
      <button
        onClick={() => void handleClose()}
        className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
