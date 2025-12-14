import React from 'react'
import { usePlatform } from '../../../hooks/usePlatform'
import { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'

/**
 * Platform-aware unified title bar component.
 * Renders the appropriate title bar based on the current platform:
 * - macOS: Traffic lights on left, toolbar items
 * - Windows: Toolbar items, window controls on right (TODO)
 * - Linux: Native decorations, toolbar only (TODO)
 */
export const UnifiedTitleBar: React.FC = () => {
  const platform = usePlatform()

  // While platform is loading, render macOS version as default
  // (prevents layout shift on initial render)
  if (!platform) {
    return <UnifiedTitleBarMacOS />
  }

  switch (platform) {
    case 'macos':
      return <UnifiedTitleBarMacOS />
    case 'windows':
      // TODO: Create UnifiedTitleBarWindows in Phase 4 step 2
      return <UnifiedTitleBarMacOS />
    case 'linux':
      // TODO: Create UnifiedTitleBarLinux in Phase 5
      return <UnifiedTitleBarMacOS />
    default:
      return <UnifiedTitleBarMacOS />
  }
}

// Re-export for direct access if needed
export { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'
export { TitleBarToolbar } from './TitleBarToolbar'
export { TrafficLights } from './TrafficLights'
