import * as React from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { Button } from '../ui/button'
import type { VariantProps } from 'class-variance-authority'
import { buttonVariants } from '../ui/button'

interface FileDropPayload {
  paths?: string[]
  position?: {
    x: number
    y: number
  }
}

export interface FileUploadButtonProps {
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
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('File selection error:', error)
      }
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
            // Prevent concurrent operations
            if (disabledRef.current || isProcessingRef.current) return

            const payload = event.payload
            const paths = payload.paths || []
            const position = payload.position

            // Check if drop happened on this button using position
            if (!buttonRef.current || !position) return

            const rect = buttonRef.current.getBoundingClientRect()
            const isOverButton =
              position.x >= rect.left &&
              position.x <= rect.right &&
              position.y >= rect.top &&
              position.y <= rect.bottom

            if (!isOverButton) return

            if (paths.length === 0) return

            // Take the first file
            const filePath = paths[0]
            if (!filePath) return

            // Validate file extension
            if (!isExtensionAccepted(filePath, accept)) {
              if (import.meta.env.DEV) {
                const extension = getFileExtension(filePath) ?? 'unknown'
                // eslint-disable-next-line no-console
                console.warn(
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
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Failed to setup drag-drop listener:', error)
        }
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
