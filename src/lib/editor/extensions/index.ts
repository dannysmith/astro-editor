/**
 * Editor extensions system
 *
 * This module provides a centralized way to create and configure
 * CodeMirror extensions for the editor:
 *
 * - Extension factory function
 * - Keymap configuration
 * - Theme setup
 * - Event handler configuration
 *
 * Usage:
 * ```typescript
 * import { createExtensions } from './extensions'
 *
 * const extensions = createExtensions({
 *   onFocus: () => handleFocus(),
 *   onBlur: () => handleBlur(),
 * })
 * ```
 */

export { createExtensions } from './createExtensions'
export { createKeymapExtensions } from './keymap'
export { createEditorTheme } from './theme'
export type { ExtensionConfig } from './createExtensions'
