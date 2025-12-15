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
        className="h-11 w-11 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Minimize"
      >
        <Minus className="size-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        onClick={() => void handleToggleMaximize()}
        className="h-11 w-11 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Maximize"
      >
        <Square className="size-3.5 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        onClick={() => void handleClose()}
        className="h-11 w-11 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors group rounded-tr-[12px]"
        aria-label="Close"
      >
        <X className="size-4 text-gray-700 dark:text-gray-300 group-hover:text-white" />
      </button>
    </div>
  )
}
