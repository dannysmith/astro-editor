import React from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { FieldWrapper } from './FieldWrapper'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { formatPathForAstro, getImageSrc } from '../../../lib/image-path'
import { getEffectiveAssetsDirectory } from '../../../lib/project-registry'
import { ASTRO_PATHS } from '../../../lib/constants'
import { toast } from '../../../lib/toast'
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

  // Ref for hidden file input
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // State for drag-and-drop and preview
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null)
  const [previewError, setPreviewError] = React.useState(false)
  const [srAnnouncement, setSrAnnouncement] = React.useState('')

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
      } catch (error) {
        setPreviewSrc(null)
        setPreviewError(true)
      }
    }

    void loadPreview()
  }, [imagePath, projectPath, currentFile?.path])

  // Handler for "Choose Image" button click
  const handleChooseImage = () => {
    fileInputRef.current?.click()
  }

  // Handler for file selection
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Get the file path from the browser File object
    const sourcePath = (file as File & { path?: string }).path
    if (!sourcePath) {
      toast.error('Could not get file path', {
        description: 'Please try dragging and dropping instead',
      })
      return
    }

    // Process the file
    await processImageFile(sourcePath)

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handler for clearing the image
  const handleClear = () => {
    updateFrontmatterField(name, undefined)
    // Screen reader announcement
    setSrAnnouncement('Image removed')
  }

  // Shared logic for processing an image file
  const processImageFile = async (sourcePath: string) => {
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
  }

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dragging to false if we're leaving the drop zone itself
    // (not just moving between child elements)
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Required to allow drop
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    // Get the first file from the drop
    const file = e.dataTransfer.files[0]
    if (!file) return

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', {
        description: 'Please drop an image file',
      })
      return
    }

    // Get the file path (Tauri provides this)
    const sourcePath = (file as File & { path?: string }).path
    if (!sourcePath) {
      toast.error('Could not get file path', {
        description: 'Please try using the file picker instead',
      })
      return
    }

    // Process the dropped file
    await processImageFile(sourcePath)
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
        {/* Hidden file input */}
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          aria-label={`Choose image for ${label}`}
        />

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
                  onClick={handleChooseImage}
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
