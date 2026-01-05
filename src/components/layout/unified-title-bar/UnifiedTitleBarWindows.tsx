import React from 'react'
import { WindowsControls } from './WindowsControls'
import { WindowsMenu } from './WindowsMenu'
import { TitleBarToolbar } from './TitleBarToolbar'

/**
 * Windows-specific unified title bar with window controls on the right.
 * Uses custom decorations (no native title bar) with drag region support.
 * Includes overflow menu for app functions that macOS gets via native menu bar.
 */
export const UnifiedTitleBarWindows: React.FC = () => {
  return (
    <TitleBarToolbar
      rightSlot={
        <>
          <WindowsMenu />
          <WindowsControls />
        </>
      }
    />
  )
}
