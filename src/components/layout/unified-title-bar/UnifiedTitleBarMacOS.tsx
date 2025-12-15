import React from 'react'
import { TrafficLights } from './TrafficLights'
import { TitleBarToolbar } from './TitleBarToolbar'

/**
 * macOS-specific unified title bar with traffic light window controls.
 * Traffic lights are positioned on the left, before the sidebar toggle.
 */
export const UnifiedTitleBarMacOS: React.FC = () => {
  return <TitleBarToolbar leftSlot={<TrafficLights />} />
}
