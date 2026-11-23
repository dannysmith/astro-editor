/**
 * Layout size constants for ResizablePanels
 * Centralized to ensure consistency across the application
 */
export const LAYOUT_SIZES = {
  leftSidebar: {
    default: '20',
    // In pixels, the narrowest its contents are designed for, at any window size
    min: '200px',
    max: '35',
  },
  rightSidebar: {
    default: '25',
    min: '20',
    max: '40',
  },
  mainEditor: {
    default: '55',
    min: '40',
  },
} as const
