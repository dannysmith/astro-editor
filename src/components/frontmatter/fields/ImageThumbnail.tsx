import React from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useEditorStore } from '../../../store/editorStore'
import { useImageSrcQuery } from '../../../hooks/queries/useImageSrcQuery'

interface ImageThumbnailProps {
  path: string
}

/** A small preview of an image path from the open file. Shows nothing if the path doesn't resolve. */
export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ path }) => {
  const projectPath = useProjectStore(state => state.projectPath)
  const currentFilePath = useEditorStore(state => state.currentFile?.path)
  const { data: imageUrl, isError } = useImageSrcQuery(
    path,
    projectPath,
    currentFilePath ?? null
  )
  // An image that fails to load is treated like a path that fails to resolve
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)

  if (
    !path ||
    !projectPath ||
    isError ||
    (imageUrl && imageUrl === failedUrl)
  ) {
    return null
  }

  return (
    <div className="relative w-full max-w-[200px]">
      {imageUrl ? (
        <img
          // A new element per image: changing an <img>'s src keeps painting
          // the old picture until the new one loads
          key={imageUrl}
          src={imageUrl}
          alt="Preview"
          className="max-h-[150px] max-w-full rounded-md border border-border object-contain"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md border border-border bg-muted/30">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
        </div>
      )}
    </div>
  )
}
