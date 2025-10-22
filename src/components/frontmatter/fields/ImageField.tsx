import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { FieldWrapper } from './FieldWrapper'
import { ImageThumbnail } from './ImageThumbnail'
import { FileUploadButton } from '../../tauri'
import { getEffectiveAssetsDirectory } from '../../../lib/project-registry'
import { ASTRO_PATHS } from '../../../lib/constants'
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

  const stringValue = typeof value === 'string' ? value : ''

  const handleFileSelect = async (filePath: string) => {
    setIsLoading(true)

    const { projectPath, currentProjectSettings } = useProjectStore.getState()
    const { currentFile } = useEditorStore.getState()
    const collection = currentFile?.collection

    try {
      // If no project or no current file, we can't process the file properly
      if (!projectPath || !currentFile || !collection) {
        // Just set the path directly as a fallback
        updateFrontmatterField(name, filePath)
        return
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
        {stringValue && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{stringValue}</div>
            <ImageThumbnail path={stringValue} />
          </div>
        )}

        {/* File upload button */}
        <FileUploadButton
          accept={IMAGE_EXTENSIONS}
          onFileSelect={handleFileSelect}
          disabled={isLoading}
        >
          {stringValue ? 'Change Image' : 'Select Image'}
        </FileUploadButton>
      </div>
    </FieldWrapper>
  )
}
