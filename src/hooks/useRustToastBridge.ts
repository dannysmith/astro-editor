import { useEffect } from 'react'
import { initializeRustToastBridge } from '../lib/rust-toast-bridge'

/**
 * Initializes bi-directional toast communication with the Rust backend.
 *
 * This hook sets up event listeners for toast notifications that originate
 * from the Tauri/Rust backend, allowing the backend to display UI notifications.
 */
export function useRustToastBridge() {
  useEffect(() => {
    let cleanup: (() => void) | undefined

    void initializeRustToastBridge().then(unlisten => {
      cleanup = unlisten
    })

    return () => {
      cleanup?.()
    }
  }, [])
}
