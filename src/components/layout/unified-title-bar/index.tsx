import React from 'react'
import { usePlatform } from '../../../hooks/usePlatform'
import { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'
import { UnifiedTitleBarWindows } from './UnifiedTitleBarWindows'
import { UnifiedTitleBarLinux } from './UnifiedTitleBarLinux'

// TEMPORARY: Set to true to preview Windows title bar on macOS during development
const FORCE_WINDOWS_TITLEBAR = false

// TEMPORARY: Set to true to preview Linux title bar on macOS during development
// Note: To see the full Linux experience (native decorations + toolbar), also set
// "decorations": true and "transparent": false in tauri.conf.json, then restart dev server
const FORCE_LINUX_TITLEBAR = false

/**
 * Platform-aware unified title bar component.
 * Renders the appropriate title bar based on the current platform:
 * - macOS: Traffic lights on left, toolbar items
 * - Windows: Toolbar items, window controls on right
 * - Linux: Native decorations, toolbar only (no window controls in our UI)
 */
export const UnifiedTitleBar: React.FC = () => {
  const platform = usePlatform()

  // TEMPORARY: Force specific title bar for development/testing
  if (FORCE_WINDOWS_TITLEBAR) {
    return <UnifiedTitleBarWindows />
  }
  if (FORCE_LINUX_TITLEBAR) {
    return <UnifiedTitleBarLinux />
  }

  // While platform is loading, render macOS version as default
  // (prevents layout shift on initial render)
  if (!platform) {
    return <UnifiedTitleBarMacOS />
  }

  switch (platform) {
    case 'macos':
      return <UnifiedTitleBarMacOS />
    case 'windows':
      return <UnifiedTitleBarWindows />
    case 'linux':
      return <UnifiedTitleBarLinux />
    default:
      return <UnifiedTitleBarMacOS />
  }
}

// Re-export for direct access if needed
export { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'
export { UnifiedTitleBarWindows } from './UnifiedTitleBarWindows'
export { UnifiedTitleBarLinux } from './UnifiedTitleBarLinux'
export { TitleBarToolbar } from './TitleBarToolbar'
export { TrafficLights } from './TrafficLights'
export { WindowsControls } from './WindowsControls'
