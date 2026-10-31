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
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { processFileToAssets, IMAGE_EXTENSIONS } from '../../lib/files'
import { getCollectionSettings } from '../../lib/project-registry/collection-settings'
import type { ProjectSettings } from '../../lib/project-registry/types'
import { toast } from '../../lib/toast'
import { FormField } from './FormField'

/**
 * Whether image props can be picked rather than typed: when the project adds
 * imports, and the collection's images go somewhere under `src/`, which is
 * the only place Astro imports images from
 */
export function canPickImages(
  settings: ProjectSettings | null,
  collection: string | undefined
): boolean {
  if (!settings?.addComponentImports || !collection) return false
  const { assetsDirectory } = getCollectionSettings(
    settings,
    collection
  ).pathOverrides
  return /^(\.?\/)?src(\/|$)/.test(assetsDirectory)
}

/**
 * An image prop: pick a file, which is copied into the assets directory as
 * the frontmatter's image fields do, then imported. The prop's value is the
 * name it's imported as.
 */
export function ImagePropField({
  prop,
  label,
  required,
  description,
}: {
  prop: PropInfo
  label: string
  required: boolean
  description: string
}) {
  const image = useComponentBuilderStore(state => state.images[prop.name])
  const setImage = useComponentBuilderStore(state => state.setImage)
  const [isLoading, setIsLoading] = React.useState(false)
  const id = React.useId()
  const labelId = `${id}-label`

  const handleFileSelect = async (filePath: string) => {
    setIsLoading(true)
    try {
      const { projectPath, currentProjectSettings } = useProjectStore.getState()
      const { currentFile } = useEditorStore.getState()
      if (!projectPath || !currentFile) throw new Error('No file is open')

      const result = await processFileToAssets({
        sourcePath: filePath,
        projectPath,
        collection: currentFile.collection,
        projectSettings: currentProjectSettings,
        copyStrategy: 'only-if-outside-project',
        currentFilePath: currentFile.path,
        useRelativePaths: getCollectionSettings(
          currentProjectSettings,
          currentFile.collection
        ).useRelativeAssetPaths,
      })
      await setImage(prop.name, {
        file_name: result.filename,
        specifier: result.relativePath,
      })
    } catch (error) {
      toast.error('Failed to add image', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <FormField
      label={label}
      labelId={labelId}
      required={required}
      description={description}
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
