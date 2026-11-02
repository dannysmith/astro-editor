import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { FieldWrapper } from './FieldWrapper'
import { ImagePicker } from './ImagePicker'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface ImageArrayFieldProps extends FieldProps {
  field?: SchemaField
}

/**
 * A list of images (`z.array(image())`): a picker for each image, where
 * clearing one removes it, then an empty picker that adds another.
 */
export const ImageArrayField: React.FC<ImageArrayFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )
  const labelId = `${React.useId()}-label`

  const images = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

  // Picking a file is async, so read the list when the change lands rather
  // than when it started
  const updateImages = (change: (current: string[]) => string[]) => {
    const current = getNestedValue(useEditorStore.getState().frontmatter, name)
    const next = change(
      Array.isArray(current)
        ? current.filter((item): item is string => typeof item === 'string')
        : []
    )
    updateFrontmatterField(name, next.length > 0 ? next : undefined)
  }

  const handleChange = (index: number, path: string | undefined) => {
    updateImages(current =>
      path === undefined
        ? current.filter((_, i) => i !== index)
        : current.map((item, i) => (i === index ? path : item))
    )
  }

  return (
    <FieldWrapper
      label={label}
      labelId={labelId}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <div className="space-y-4">
        {images.map((path, index) => (
          <ImagePicker
            // The path is in the key so a removal doesn't leave one image's
            // editing state on its neighbour
            key={`${index}:${path}`}
            value={path}
            onChange={newPath => handleChange(index, newPath)}
            labelId={labelId}
          />
        ))}
        <ImagePicker
          value=""
          onChange={path => {
            if (path) updateImages(current => [...current, path])
          }}
          labelId={labelId}
          selectLabel={images.length > 0 ? 'Add Image' : 'Select Image'}
        />
      </div>
    </FieldWrapper>
  )
}
