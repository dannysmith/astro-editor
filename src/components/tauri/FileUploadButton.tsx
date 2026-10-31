import * as React from 'react'
import { debug, error as logError } from '@tauri-apps/plugin-log'
import { open } from '@tauri-apps/plugin-dialog'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { Button } from '../ui/button'
import type { VariantProps } from 'class-variance-authority'
import { buttonVariants } from '../ui/button'
import { isDropWithinElement } from '../../lib/editor/dragdrop'

// GLOBAL deduplication tracker for drag-drop events
// This prevents Tauri's duplicate event firing from affecting ANY FileUploadButton
const globalDragDropTracker = {
  lastFile: null as string | null,
  lastTime: 0,
  THRESHOLD_MS: 100,
}

interface FileDropPayload {
  paths?: string[]
  position?: {
    x: number
    y: number
  }
}

export interface FileUploadButtonProps {
  id?: string
  'aria-labelledby'?: string
  /** File extensions to accept (e.g., ['png', 'jpg', 'jpeg']) */
  accept: string[]
  /** Callback when file is selected (receives absolute file path) */
  onFileSelect: (path: string) => void | Promise<void>
  /** Whether the button is disabled */
  disabled?: boolean
  /** Button content */
  children: React.ReactNode
  /** Additional CSS class */
  className?: string
  /** Button variant */
  variant?: VariantProps<typeof buttonVariants>['variant']
  /** Button size */
  size?: VariantProps<typeof buttonVariants>['size']
}

/**
 * Extract file extension from path
 */
function getFileExtension(path: string): string | null {
  const extension = path.split('.').pop()?.toLowerCase()
  return extension || null
}

/**
 * Check if file extension is accepted
 */
function isExtensionAccepted(
  path: string,
  acceptedExtensions: string[]
): boolean {
  const extension = getFileExtension(path)
  return extension ? acceptedExtensions.includes(extension) : false
}

/**
 * File upload button component for Tauri applications
 *
 * Supports both file picker dialog and drag-and-drop.
 * Returns real file paths (not browser File objects).
 *
 * @example
 * ```tsx
 * <FileUploadButton
 *   accept={['png', 'jpg', 'jpeg', 'gif', 'webp']}
 *   onFileSelect={async (path) => {
 *     console.log('Selected file:', path)
 *   }}
 * >
 *   Select Image
 * </FileUploadButton>
 * ```
 */
export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  id,
  'aria-labelledby': ariaLabelledBy,
  accept,
  onFileSelect,
  disabled = false,
  children,
  className,
  variant = 'outline',
  size = 'default',
}) => {
  const [isProcessing, setIsProcessing] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const unlistenRef = React.useRef<UnlistenFn | null>(null)

  // Store callback in ref to avoid useEffect re-runs
  const onFileSelectRef = React.useRef(onFileSelect)
  React.useEffect(() => {
    onFileSelectRef.current = onFileSelect
  }, [onFileSelect])

  // Store disabled and isProcessing in refs for drag-drop handler
  const isProcessingRef = React.useRef(isProcessing)
  React.useEffect(() => {
    isProcessingRef.current = isProcessing
  }, [isProcessing])

  const disabledRef = React.useRef(disabled)
  React.useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  // Handle file picker dialog
  const handleClick = React.useCallback(async () => {
    if (disabled || isProcessing) return

    try {
      setIsProcessing(true)

      const filters = [
        {
          name: 'Files',
          extensions: accept,
        },
      ]

      const selected = await open({
        multiple: false,
        filters,
      })

      // User cancelled
      if (!selected) {
        return
      }

      // Call the callback with the selected file path
      await onFileSelectRef.current(selected)
    } catch (error) {
      void logError(`File selection error: ${String(error)}`)
    } finally {
      setIsProcessing(false)
    }
  }, [accept, disabled, isProcessing])

  // Handle drag and drop via Tauri events
  React.useEffect(() => {
    const setupDragDropListener = async () => {
      try {
        // Listen for file drop events from Tauri
        const unlisten = await listen<FileDropPayload>(
          'tauri://drag-drop',
          event => {
            const payload = event.payload
            const paths = payload.paths || []
            const position = payload.position

            // Only a drop on this button, and not on something covering it
            if (!isDropWithinElement(position, buttonRef.current)) return

            if (paths.length === 0) return

            // Take the first file
            const filePath = paths[0]
            if (!filePath) return

            // CRITICAL: GLOBAL deduplication - Tauri fires drag-drop events multiple times
            // This must happen BEFORE any other checks to catch all duplicates
            const now = Date.now()
            if (
              globalDragDropTracker.lastFile === filePath &&
              now - globalDragDropTracker.lastTime <
                globalDragDropTracker.THRESHOLD_MS
            ) {
              if (import.meta.env.DEV) {
                void debug(
                  `[FileUploadButton] BLOCKED duplicate drag-drop event for: ${filePath} (${now - globalDragDropTracker.lastTime}ms ago)`
                )
              }
              return
            }

            // Update GLOBAL deduplication tracking IMMEDIATELY
            globalDragDropTracker.lastFile = filePath
            globalDragDropTracker.lastTime = now

            // Prevent concurrent operations on THIS button
            if (disabledRef.current || isProcessingRef.current) {
              return
            }

            // Validate file extension
            if (!isExtensionAccepted(filePath, accept)) {
              if (import.meta.env.DEV) {
                const extension = getFileExtension(filePath) ?? 'unknown'
                void debug(
                  `File type .${extension} not accepted. Expected: ${accept.join(', ')}`
                )
              }
              return
            }

            // Process the file - use ref to avoid dependency
            setIsProcessing(true)
            void Promise.resolve(onFileSelectRef.current(filePath)).finally(
              () => {
                setIsProcessing(false)
              }
            )
          }
        )

        unlistenRef.current = unlisten
      } catch (error) {
        void logError(`Failed to setup drag-drop listener: ${String(error)}`)
      }
    }

    void setupDragDropListener()

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current()
      }
    }
  }, [accept])

  return (
    <Button
      ref={buttonRef}
      id={id}
      aria-labelledby={ariaLabelledBy}
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || isProcessing}
      onClick={() => void handleClick()}
      type="button"
    >
      {children}
    </Button>
  )
}
