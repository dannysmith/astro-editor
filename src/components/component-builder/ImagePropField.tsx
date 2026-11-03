import React from 'react'
import { Loader2, X } from 'lucide-react'
import type { PropInfo } from '@/types'
import { FileUploadButton } from '../tauri'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../ui/input-group'
import { ImageThumbnail } from '../frontmatter/fields/ImageThumbnail'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import {
  copyImageToAssets,
  showAddImageError,
  IMAGE_EXTENSIONS,
} from '../../lib/files'
import { FormField } from './FormField'

/**
 * An image prop: pick a file, which is copied into the assets directory as
 * the frontmatter's image fields do, then imported. The tag gets the name
 * it's imported as.
 */
export function ImagePropField({ prop }: { prop: PropInfo }) {
  const image = useComponentBuilderStore(state => state.images[prop.name])
  const setImage = useComponentBuilderStore(state => state.setImage)
  const [isLoading, setIsLoading] = React.useState(false)
  const id = React.useId()
  const labelId = `${id}-label`

  const handleFileSelect = async (filePath: string) => {
    setIsLoading(true)
    await copyImageToAssets(filePath)
      .then(result =>
        setImage(prop.name, {
          file_name: result.filename,
          specifier: result.relativePath,
        })
      )
      .catch(showAddImageError)
    setIsLoading(false)
  }

  return (
    <FormField
      label={prop.name}
      labelId={labelId}
      required={!prop.is_optional}
      description={prop.description ?? ''}
    >
      <div className="flex flex-col gap-2">
        {image && (
          <InputGroup>
            <InputGroupInput
              aria-labelledby={labelId}
              value={image.specifier}
              disabled
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => void setImage(prop.name, undefined)}
                title="Clear image"
              >
                <X className="size-3.5" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
        <FileUploadButton
          id={id}
          aria-labelledby={`${labelId} ${id}`}
          accept={[...IMAGE_EXTENSIONS]}
          onFileSelect={handleFileSelect}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {image ? 'Change Image' : 'Select Image'}
        </FileUploadButton>
        {image && <ImageThumbnail path={image.specifier} />}
      </div>
    </FormField>
  )
}
