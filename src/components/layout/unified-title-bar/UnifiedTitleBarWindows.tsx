import React from 'react'
import { WindowsControls } from './WindowsControls'
import { TitleBarToolbar } from './TitleBarToolbar'

/**
 * Windows-specific unified title bar with window controls on the right.
 * Uses custom decorations (no native title bar) with drag region support.
 */
export const UnifiedTitleBarWindows: React.FC = () => {
  return <TitleBarToolbar rightSlot={<WindowsControls />} />
}
