import React from 'react'
import { TitleBarToolbar } from './TitleBarToolbar'

/**
 * Linux-specific unified title bar - toolbar only, no window controls.
 * Linux uses native decorations (GNOME, KDE, etc.) for window controls,
 * so we only render the toolbar below the native title bar.
 *
 * To test on macOS:
 * 1. Set FORCE_LINUX_TITLEBAR = true in index.tsx
 * 2. In tauri.conf.json, set "decorations": true and "transparent": false
 * 3. Restart the dev server
 */
export const UnifiedTitleBarLinux: React.FC = () => {
  return <TitleBarToolbar />
}
