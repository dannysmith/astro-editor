import { listen } from '@tauri-apps/api/event'
import { error as logError } from '@tauri-apps/plugin-log'
import { toast } from './toast'

/**
 * Types for Rust-to-frontend toast events
 */
export interface RustToastEvent {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
}

/**
 * Initialize the Rust-to-frontend toast bridge
 *
 * This function sets up event listeners for toast notifications
 * sent from the Rust backend. Call this once during app initialization.
 *
 * Usage in Rust:
 * ```rust
 * use tauri::Manager;
 *
 * // Send a success toast
 * app.emit("rust-toast", RustToastEvent {
 *   type: "success",
 *   message: "Operation completed successfully",
 *   description: Some("The file has been processed".to_string()),
 *   duration: None,
 * })?;
 *
 * // Send an error toast
 * app.emit("rust-toast", RustToastEvent {
 *   type: "error",
 *   message: "Operation failed",
 *   description: Some("Permission denied".to_string()),
 *   duration: Some(5000),
 * })?;
 * ```
 */
export const initializeRustToastBridge = async () => {
  try {
    // Listen for toast events from Rust
    const unlisten = await listen<RustToastEvent>('rust-toast', event => {
      const { type, message, description, duration } = event.payload

      switch (type) {
        case 'success':
          toast.success(message, { description, duration })
          break
        case 'error':
          toast.error(message, { description, duration })
          break
        case 'warning':
          toast.warning(message, { description, duration })
          break
        case 'info':
          toast.info(message, { description, duration })
          break
        default:
          toast.message(message, { description, duration })
      }
    })

    // Return cleanup function
    return unlisten
  } catch (error) {
    void logError(`Failed to initialize Rust toast bridge: ${String(error)}`)
    return () => {} // Return empty cleanup function
  }
}

/**
 * Cleanup function type for TypeScript
 */
export type RustToastBridgeCleanup = () => void
