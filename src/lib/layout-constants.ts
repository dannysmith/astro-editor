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
    min: 40,
    // Dynamic defaults based on panel visibility
    getDefault: (leftVisible: boolean, rightVisible: boolean) => {
      if (leftVisible && rightVisible) return 55
      if (leftVisible) return 80
      if (rightVisible) return 75
      return 100
    },
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
