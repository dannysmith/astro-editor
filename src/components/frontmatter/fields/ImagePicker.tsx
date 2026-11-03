import React, { useState } from 'react'
import { debug } from '@tauri-apps/plugin-log'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { ImageThumbnail } from './ImageThumbnail'
import { FileUploadButton } from '../../tauri'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../ui/input-group'
import {
  copyImageToAssets,
  showAddImageError,
  IMAGE_EXTENSIONS,
} from '../../../lib/files'
import { X, Loader2, Edit3, Check } from 'lucide-react'

interface ImagePickerProps {
  /** The image path, or '' for none */
  value: string
  /** Called with the new path, or undefined when the image is cleared */
  onChange: (path: string | undefined) => void
  /** The field label's id, which names the path input and the button */
  labelId: string
  /** The button's text when there's no image */
  selectLabel?: string
}

/**
 * One image: its path (editable by hand), a button that picks a file and
 * copies it into the collection's assets, and a preview. Used by ImageField and
 * once per image by ImageArrayField.
 */
export const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
  labelId,
  selectLabel = 'Select Image',
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const id = React.useId()

  // When editing, show edit value; otherwise show current value
  const displayValue = isEditing ? editValue : value

  const handleFileSelect = async (filePath: string) => {
    setIsLoading(true)
    // Capture the starting file and project to detect switches during the copy
    const startingFileId = useEditorStore.getState().currentFile?.id
    const startingProject = useProjectStore.getState().projectPath

    const result = await copyImageToAssets(filePath).catch(showAddImageError)
    setIsLoading(false)
    if (!result) return

    // CRITICAL: Check if the user switched files during the async operation
    // If they did, DO NOT update frontmatter (would corrupt the new file)
    if (
      useEditorStore.getState().currentFile?.id !== startingFileId ||
      useProjectStore.getState().projectPath !== startingProject
    ) {
      if (import.meta.env.DEV) {
        void debug(
          '[ImagePicker] File switched during image processing - aborting frontmatter update to prevent data corruption'
        )
      }
      return
    }

    onChange(result.relativePath)
  }

  const handleEditStart = () => {
    setEditValue(value)
    setIsEditing(true)
  }

  const handleEditCancel = () => {
    setEditValue('')
    setIsEditing(false)
  }

  const handleEditSave = () => {
    // Manual edit: user has full control, no validation. An empty path clears
    // the image; a missing file just fails to preview
    onChange(editValue.trim() || undefined)
    setIsEditing(false)
    setEditValue('')
  }

  return (
    <div className="space-y-2">
      {/* Path display/edit with InputGroup - only shown when image exists */}
      {value && (
        <InputGroup>
          <InputGroupInput
            aria-labelledby={labelId}
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
                  onClick={() => onChange(undefined)}
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
        id={id}
        aria-labelledby={`${labelId} ${id}`}
        accept={[...IMAGE_EXTENSIONS]}
        onFileSelect={handleFileSelect}
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {value ? 'Change Image' : selectLabel}
      </FileUploadButton>

      {/* Preview - always shown when value exists, never hidden during editing */}
      {value && <ImageThumbnail path={value} />}
    </div>
  )
}
