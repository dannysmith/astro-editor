import React from 'react'
import { usePlatform } from '../../../hooks/usePlatform'
import { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'
import { UnifiedTitleBarWindows } from './UnifiedTitleBarWindows'

// TEMPORARY: Set to true to preview Windows title bar on macOS during development
const FORCE_WINDOWS_TITLEBAR = false

/**
 * Platform-aware unified title bar component.
 * Renders the appropriate title bar based on the current platform:
 * - macOS: Traffic lights on left, toolbar items
 * - Windows: Toolbar items, window controls on right
 * - Linux: Native decorations, toolbar only (TODO)
 */
export const UnifiedTitleBar: React.FC = () => {
  const platform = usePlatform()

  // TEMPORARY: Force Windows title bar for development/testing
  if (FORCE_WINDOWS_TITLEBAR) {
    return <UnifiedTitleBarWindows />
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
      // TODO: Create UnifiedTitleBarLinux in Phase 5 (uses native decorations + toolbar only)
      // For now, use Windows version (custom title bar with controls on right)
      return <UnifiedTitleBarWindows />
    default:
      return <UnifiedTitleBarMacOS />
  }
}

// Re-export for direct access if needed
export { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'
export { UnifiedTitleBarWindows } from './UnifiedTitleBarWindows'
export { TitleBarToolbar } from './TitleBarToolbar'
export { TrafficLights } from './TrafficLights'
export { WindowsControls } from './WindowsControls'
