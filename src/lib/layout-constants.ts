/**
 * Layout size constants for ResizablePanels
 * Centralized to ensure consistency across the application
 */
export const LAYOUT_SIZES = {
  leftSidebar: {
    default: 20,
    min: 15,
    max: 35,
    minWidth: '200px', // Minimum pixel width for usability
  },
  rightSidebar: {
    default: 25,
    min: 20,
    max: 40,
  },
  mainEditor: {
    default: 55,
    min: 40,
  },
} as const

/**
 * UI element heights and spacing
 */
export const UI_SIZES = {
  titleBar: {
    paddingY: 1.5, // py-1.5 = 6px
  },
} as const
