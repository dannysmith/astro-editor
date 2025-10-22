import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { FieldWrapper } from './FieldWrapper'
import { ImageThumbnail } from './ImageThumbnail'
import { FileUploadButton } from '../../tauri'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { getEffectiveAssetsDirectory } from '../../../lib/project-registry'
import { ASTRO_PATHS } from '../../../lib/constants'
import { X, Loader2, Edit3 } from 'lucide-react'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface ImageFieldProps extends FieldProps {
  field?: SchemaField
}

// Supported image extensions
const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
]

export const ImageField: React.FC<ImageFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()
  const value = getNestedValue(frontmatter, name)
  const [isLoading, setIsLoading] = useState(false)
  const [isManualEdit, setIsManualEdit] = useState(false)
  const [manualPath, setManualPath] = useState('')

  const stringValue = typeof value === 'string' ? value : ''

  const handleFileSelect = async (filePath: string) => {
    setIsLoading(true)

    const { projectPath, currentProjectSettings } = useProjectStore.getState()
    const { currentFile } = useEditorStore.getState()
    const collection = currentFile?.collection

    try {
      // If no project or no current file, we can't process the file properly
      if (!projectPath || !currentFile || !collection) {
        throw new Error('No project or collection context available')
      }

      // Get effective assets directory (respects collection and project overrides)
      const assetsDirectory = getEffectiveAssetsDirectory(
        currentProjectSettings,
        collection
      )

      // Copy file to assets directory
      let relativePath: string
      if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
        // Use override path
        relativePath = await invoke<string>(
          'copy_file_to_assets_with_override',
          {
            sourcePath: filePath,
            projectPath: projectPath,
            collection: collection,
            assetsDirectory: assetsDirectory,
          }
        )
      } else {
        // Use default path
        relativePath = await invoke<string>('copy_file_to_assets', {
          sourcePath: filePath,
          projectPath: projectPath,
          collection: collection,
        })
      }

      // Update frontmatter with project-root-relative path
      updateFrontmatterField(name, `/${relativePath}`)

      // Show success toast
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            title: 'Image added',
            description: 'Image has been copied to assets directory',
          },
        })
      )
    } catch (error) {
      // Show error toast
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            title: 'Failed to add image',
            description:
              error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          },
        })
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    updateFrontmatterField(name, undefined)
  }

  const handleManualEditToggle = () => {
    if (isManualEdit) {
      // Cancel manual edit - reset to current value
      setManualPath('')
      setIsManualEdit(false)
    } else {
      // Start manual edit - initialize with current value
      setManualPath(stringValue)
      setIsManualEdit(true)
    }
  }

  const handleManualPathSave = async () => {
    const trimmedPath = manualPath.trim()

    // Empty path means clear
    if (!trimmedPath) {
      updateFrontmatterField(name, undefined)
      setIsManualEdit(false)
      setManualPath('')
      return
    }

    // Validate the path exists in the project
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            title: 'Invalid path',
            description: 'No project context available',
            variant: 'destructive',
          },
        })
      )
      return
    }

    try {
      // Try to read the file to validate it exists
      // Use the resolve_image_path command to validate
      await invoke<string>('resolve_image_path', {
        imagePath: trimmedPath,
        projectPath: projectPath,
      })

      // Path is valid, update frontmatter
      updateFrontmatterField(name, trimmedPath)
      setIsManualEdit(false)
      setManualPath('')

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            title: 'Path updated',
            description: 'Image path has been updated',
          },
        })
      )
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            title: 'Invalid path',
            description:
              error instanceof Error
                ? error.message
                : 'Path does not exist or is outside the project',
            variant: 'destructive',
          },
        })
      )
    }
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
      <div className="space-y-2">
        {/* Current path display and preview */}
        {stringValue && !isManualEdit && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {stringValue}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClear}
                type="button"
                title="Clear image"
              >
                <X className="size-3" />
              </Button>
            </div>
            <ImageThumbnail path={stringValue} />
          </div>
        )}

        {/* Manual path editing */}
        {isManualEdit && (
          <div className="space-y-2">
            <Input
              type="text"
              value={manualPath}
              onChange={e => setManualPath(e.target.value)}
              placeholder="Enter image path (e.g., /src/assets/image.jpg)"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleManualPathSave()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  handleManualEditToggle()
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleManualPathSave()}
                type="button"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualEditToggle}
                type="button"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* File upload button and manual edit toggle */}
        {!isManualEdit && (
          <div className="flex items-center gap-2">
            <FileUploadButton
              accept={IMAGE_EXTENSIONS}
              onFileSelect={handleFileSelect}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {stringValue ? 'Change Image' : 'Select Image'}
            </FileUploadButton>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualEditToggle}
              type="button"
              title="Edit path manually"
            >
              <Edit3 className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </FieldWrapper>
  )
}
