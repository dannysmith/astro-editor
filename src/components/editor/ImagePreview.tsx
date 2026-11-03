import React, { useState } from 'react'
import type { HoveredImage } from '../../hooks/editor/useImageHover'
import { useImageSrcQuery } from '../../hooks/queries/useImageSrcQuery'

interface ImagePreviewProps {
  hoveredImage: HoveredImage | null
  projectPath: string
  currentFilePath: string | null
}

/**
 * The preview shown while Alt is held over an image path in the editor. Shows a
 * spinner until the hovered image has loaded, and nothing for a path that
 * doesn't resolve or an image that doesn't load.
 */
const ImagePreviewComponent: React.FC<ImagePreviewProps> = ({
  hoveredImage,
  projectPath,
  currentFilePath,
}) => {
  const { data: imageUrl, isError } = useImageSrcQuery(
    hoveredImage?.url,
    projectPath,
    currentFilePath
  )
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  // An image that fails to load is treated like a path that fails to resolve
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const isLoaded = !!imageUrl && imageUrl === loadedUrl

  if (!hoveredImage || isError || (imageUrl && imageUrl === failedUrl)) {
    return null
  }

  return (
    <div
      className="image-preview-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        maxWidth: '300px',
        maxHeight: '300px',
        backgroundColor: 'var(--image-preview)',
        border: '1px solid var(--image-preview-border)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px var(--image-preview-shadow)',
        padding: '12px',
        zIndex: 1000,
        transition: 'opacity 0.2s ease-in-out',
        backdropFilter: 'blur(10px)',
      }}
    >
      {!isLoaded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '100px',
            minHeight: '100px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid var(--image-preview-border)',
              borderTopColor: 'var(--image-preview-spinner)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {imageUrl && (
        <img
          // A new element per image: changing an <img>'s src keeps painting
          // the old picture until the new one loads
          key={imageUrl}
          src={imageUrl}
          alt="Preview"
          style={{
            maxWidth: '100%',
            maxHeight: '276px', // 300px - (12px padding * 2)
            objectFit: 'contain',
            display: isLoaded ? 'block' : 'none',
          }}
          onLoad={() => setLoadedUrl(imageUrl)}
          onError={() => setFailedUrl(imageUrl)}
        />
      )}

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export const ImagePreview = ImagePreviewComponent
