import React, { useState } from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { FieldWrapper } from './FieldWrapper'
import { ImageThumbnail } from './ImageThumbnail'
import { FileUploadButton } from '../../tauri'
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
    try {
      // For Phase 2, we just set the path directly
      // Phase 3 will add the file copying logic
      updateFrontmatterField(name, filePath)
    } catch (error) {
      // Error handling will be added in Phase 3
      // eslint-disable-next-line no-console
      console.error('Failed to handle file selection:', error)
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
