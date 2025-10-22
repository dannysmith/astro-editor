/**
 * Editor hooks
 *
 * This module provides React hooks for editor functionality:
 *
 * - Editor setup and configuration
 * - Event handlers for editor interactions
 * - Tauri event listeners
 * - Image hover detection for preview feature
 *
 * These hooks encapsulate complex editor logic and make the main
 * component much simpler and more focused.
 */

export { useEditorSetup } from './useEditorSetup'
export { useEditorHandlers } from './useEditorHandlers'
export { useTauriListeners } from './useTauriListeners'
export { useImageHover } from './useImageHover'
export type { HoveredImage } from './useImageHover'
