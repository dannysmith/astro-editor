import React from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { Button } from '../../ui/button'
import { FieldWrapper } from './FieldWrapper'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { formatPathForAstro, getImageSrc } from '../../../lib/image-path'
import { getEffectiveAssetsDirectory } from '../../../lib/project-registry'
import { ASTRO_PATHS } from '../../../lib/constants'
import { toast } from '../../../lib/toast'
import { claimDrop, isDropClaimed } from '../../../lib/drop-coordinator'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface ImageFieldProps extends FieldProps {
  field?: SchemaField
}

export const ImageField: React.FC<ImageFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField, currentFile } = useEditorStore()
  const { projectPath, currentProjectSettings } = useProjectStore()
  const value = getNestedValue(frontmatter, name)
  const imagePath = typeof value === 'string' ? value : ''

  // State for drag-and-drop and preview
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null)
  const [previewError, setPreviewError] = React.useState(false)
  const [srAnnouncement, setSrAnnouncement] = React.useState('')

  // Ref to track if mouse is over the drop zone
  const isHoveringRef = React.useRef(false)

  // Load image preview when path changes
  React.useEffect(() => {
    const loadPreview = async () => {
      if (!imagePath || !projectPath || !currentFile?.path) {
        setPreviewSrc(null)
        setPreviewError(false)
        return
      }

      try {
        const src = await getImageSrc(imagePath, currentFile.path, projectPath)
        setPreviewSrc(src)
        setPreviewError(false)
      } catch {
        setPreviewSrc(null)
        setPreviewError(true)
      }
    }

    void loadPreview()
  }, [imagePath, projectPath, currentFile?.path])

  // Handler for "Choose Image" button click
  const handleChooseImage = async () => {
    try {
      // Use Tauri's native file dialog
      const selected = await open({
        title: 'Select Image',
        multiple: false,
        filters: [
          {
            name: 'Images',
            extensions: [
              'png',
              'jpg',
              'jpeg',
              'gif',
              'webp',
              'svg',
              'bmp',
              'ico',
            ],
          },
        ],
      })

      if (selected && typeof selected === 'string') {
        await processImageFile(selected)
      }
    } catch (error) {
      toast.error('Failed to open file dialog', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  // Handler for clearing the image
  const handleClear = () => {
    updateFrontmatterField(name, undefined)
    // Screen reader announcement
    setSrAnnouncement('Image removed')
  }

  // Shared logic for processing an image file
  const processImageFile = React.useCallback(
    async (sourcePath: string) => {
      // Validate project context
      if (!projectPath) {
        toast.error('No project open', {
          description: 'Please open a project before adding images',
        })
        return
      }

      if (!currentFile?.collection) {
        toast.error('No collection found', {
          description: 'Could not determine the current collection',
        })
        return
      }

      setIsProcessing(true)

      try {
        // Determine assets directory (collection-specific or project-level override)
        const assetsDirectory = getEffectiveAssetsDirectory(
          currentProjectSettings,
          currentFile.collection
        )

        // Copy file to assets directory using Tauri command
        let relativePath: string
        if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
          // Use collection-specific or project-level override
          relativePath = await invoke<string>(
            'copy_file_to_assets_with_override',
            {
              sourcePath,
              projectPath,
              collection: currentFile.collection,
              assetsDirectory,
            }
          )
        } else {
          // Use default assets directory
          relativePath = await invoke<string>('copy_file_to_assets', {
            sourcePath,
            projectPath,
            collection: currentFile.collection,
          })
        }

        // Format path for Astro (ensure leading slash)
        const formattedPath = formatPathForAstro(relativePath)

        // Update frontmatter field
        updateFrontmatterField(name, formattedPath)

        toast.success('Image added', {
          description: `Image copied to ${relativePath}`,
        })

        // Screen reader announcement
        setSrAnnouncement(`Image selected: ${relativePath}`)
      } catch (error) {
        toast.error('Failed to add image', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
      } finally {
        setIsProcessing(false)
      }
    },
    [
      projectPath,
      currentProjectSettings,
      currentFile,
      name,
      updateFrontmatterField,
    ]
  )

  // Set up Tauri drag-drop event listener
  React.useEffect(() => {
    const setupTauriListener = async () => {
      const unlisten = await listen<string[] | string>(
        'tauri://drag-drop',
        event => {
          // Only handle if hovering over this ImageField and not already claimed
          if (!isHoveringRef.current || isDropClaimed()) {
            return
          }

          // Claim this drop to prevent editor from processing it
          claimDrop()
          setIsDragging(false)

          // Parse file paths from payload
          let filePaths: string[] = []
          if (Array.isArray(event.payload)) {
            filePaths = event.payload
          } else if (typeof event.payload === 'string') {
            filePaths = [event.payload]
          }

          // Get first file
          const firstFile = filePaths[0]
          if (!firstFile) return

          // Validate it's an image by file extension
          const imageExtensions = [
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.webp',
            '.svg',
            '.bmp',
            '.ico',
          ]
          const isImage = imageExtensions.some(ext =>
            firstFile.toLowerCase().endsWith(ext)
          )

          if (!isImage) {
            toast.error('Invalid file type', {
              description: 'Please drop an image file',
            })
            return
          }

          // Process the dropped file
          void processImageFile(firstFile)
        }
      )

      return unlisten
    }

    const cleanup = setupTauriListener()
    return () => {
      void cleanup.then(unlisten => unlisten())
    }
  }, [processImageFile])

  // React drag handlers for visual feedback
  // (Actual drop handling is done by Tauri event listener above)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
      isHoveringRef.current = true
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only set dragging to false if we're leaving the drop zone itself
    // (not just moving between child elements)
    if (e.currentTarget === e.target) {
      setIsDragging(false)
      isHoveringRef.current = false
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Required to allow drop and show correct cursor
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    // Reset visual state - actual file processing is done by Tauri listener
    setIsDragging(false)
    isHoveringRef.current = false
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      {/* Screen reader announcements for state changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {srAnnouncement}
      </div>

      <div className="space-y-3">
        {/* Current image path display */}
        {imagePath && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate flex-1">
              {imagePath}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Clear image"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Drag-and-drop zone / Choose button */}
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            !imagePath && 'py-8'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Image preview area */}
          {imagePath ? (
            <div className="p-4 transition-opacity duration-200">
              <div className="flex items-center justify-center bg-muted/30 rounded-md overflow-hidden transition-colors duration-200">
                {previewSrc && !previewError ? (
                  <img
                    src={previewSrc}
                    alt={`Preview of ${label}`}
                    className="max-w-full max-h-64 object-contain animate-in fade-in-0 duration-300"
                    onError={() => setPreviewError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 p-4 text-center animate-in fade-in-0 duration-200">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {previewError
                        ? 'Could not load image preview'
                        : 'Loading preview...'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 transition-opacity duration-200">
              <Upload
                className={cn(
                  'h-8 w-8 text-muted-foreground transition-transform duration-200',
                  isDragging && 'scale-110'
                )}
              />
              <div className="text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleChooseImage()}
                  disabled={isProcessing}
                  className="transition-all duration-200"
                >
                  {isProcessing ? 'Processing...' : 'Choose Image'}
                </Button>
                <p
                  className={cn(
                    'text-xs text-muted-foreground mt-2 transition-colors duration-200',
                    isDragging && 'text-primary'
                  )}
                >
                  or drag and drop
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </FieldWrapper>
  )
}
