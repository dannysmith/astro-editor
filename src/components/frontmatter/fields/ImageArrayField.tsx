import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { getNestedValue } from '../../../lib/object-utils'
import { FieldWrapper } from './FieldWrapper'
import { ImagePicker } from './ImagePicker'
import type { FieldControlProps } from './types'

/**
 * A list of images (`z.array(image())`): a picker for each image, where
 * clearing one removes it, then an empty picker that adds another.
 */
export const ImageArrayField: React.FC<FieldControlProps> = ({
  name,
  label,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
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
    setValue(next.length > 0 ? next : undefined)
  }

  // Replaces or removes `oldPath`, which was at `index` when the change began.
  // A picked file is copied first, so the list may have changed by then: use
  // wherever that image is now, and drop the change if it's gone
  const handleChange = (
    index: number,
    oldPath: string,
    newPath: string | undefined
  ) => {
    updateImages(current => {
      const at = current[index] === oldPath ? index : current.indexOf(oldPath)
      if (at === -1) return current
      return newPath === undefined
        ? current.filter((_, i) => i !== at)
        : current.map((item, i) => (i === at ? newPath : item))
    })
  }

  return (
    <FieldWrapper label={label} field={field} value={value} labelId={labelId}>
      <div className="space-y-4">
        {images.map((path, index) => (
          <ImagePicker
            // The path is in the key so a removal doesn't leave one image's
            // editing state on its neighbour
            key={`${index}:${path}`}
            value={path}
            onChange={newPath => handleChange(index, path, newPath)}
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
