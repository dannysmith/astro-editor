import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { FieldWrapper } from './FieldWrapper'
import { ImageThumbnail } from './ImageThumbnail'
import { FileUploadButton } from '../../tauri'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../ui/input-group'
import { getEffectiveAssetsDirectory } from '../../../lib/project-registry'
import { ASTRO_PATHS } from '../../../lib/constants'
import { X, Loader2, Edit3, Check } from 'lucide-react'
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
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const stringValue = typeof value === 'string' ? value : ''
  // When editing, show edit value; otherwise show current value
  const displayValue = isEditing ? editValue : stringValue

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

      // Check if file is already in project
      const isInProject = await invoke<boolean>('is_path_in_project', {
        filePath: filePath,
        projectPath: projectPath,
      })

      let relativePath: string

      if (isInProject) {
        // File is already in project - use existing path
        relativePath = await invoke<string>('get_relative_path', {
          filePath: filePath,
          projectPath: projectPath,
        })
      } else {
        // File is outside project - copy it to assets directory
        // Get effective assets directory (respects collection and project overrides)
        const assetsDirectory = getEffectiveAssetsDirectory(
          currentProjectSettings,
          collection
        )

        // Copy file to assets directory
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
      }

      // Update frontmatter with project-root-relative path
      updateFrontmatterField(name, `/${relativePath}`)
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

  const handleEditStart = () => {
    setEditValue(stringValue)
    setIsEditing(true)
  }

  const handleEditCancel = () => {
    setEditValue('')
    setIsEditing(false)
  }

  const handleEditSave = () => {
    const trimmedPath = editValue.trim()

    // Empty path means clear
    if (!trimmedPath) {
      updateFrontmatterField(name, undefined)
      setIsEditing(false)
      setEditValue('')
      return
    }

    // Manual edit: user has full control, no validation
    // If the path doesn't exist, the preview will simply fail to load
    updateFrontmatterField(name, trimmedPath)
    setIsEditing(false)
    setEditValue('')
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
        {/* Path display/edit with InputGroup - only shown when image exists */}
        {stringValue && (
          <InputGroup>
            <InputGroupInput
              type="text"
              value={displayValue}
              onChange={e => setEditValue(e.target.value)}
              placeholder="Enter image path (e.g., /src/assets/image.jpg)"
              disabled={!isEditing}
              onKeyDown={e => {
                if (!isEditing) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleEditSave()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  handleEditCancel()
                }
              }}
            />
            <InputGroupAddon align="inline-end">
              {isEditing ? (
                <>
                  <InputGroupButton
                    size="icon-xs"
                    onClick={handleEditSave}
                    title="Save path"
                  >
                    <Check className="size-3.5" />
                  </InputGroupButton>
                  <InputGroupButton
                    size="icon-xs"
                    onClick={handleEditCancel}
                    title="Cancel"
                  >
                    <X className="size-3.5" />
                  </InputGroupButton>
                </>
              ) : (
                <>
                  <InputGroupButton
                    size="icon-xs"
                    onClick={handleEditStart}
                    title="Edit path manually"
                  >
                    <Edit3 className="size-3.5" />
                  </InputGroupButton>
                  <InputGroupButton
                    size="icon-xs"
                    onClick={handleClear}
                    title="Clear image"
                  >
                    <X className="size-3.5" />
                  </InputGroupButton>
                </>
              )}
            </InputGroupAddon>
          </InputGroup>
        )}

        {/* File upload button - above preview */}
        <FileUploadButton
          accept={IMAGE_EXTENSIONS}
          onFileSelect={handleFileSelect}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {stringValue ? 'Change Image' : 'Select Image'}
        </FileUploadButton>

        {/* Preview - always shown when stringValue exists, never hidden during editing */}
        {stringValue && <ImageThumbnail path={stringValue} />}
      </div>
    </FieldWrapper>
  )
}
