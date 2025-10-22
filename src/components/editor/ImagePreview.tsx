import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { HoveredImage } from '../../hooks/editor/useImageHover'

interface ImagePreviewProps {
  hoveredImage: HoveredImage | null
  projectPath: string
  currentFilePath: string | null
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

const ImagePreviewComponent: React.FC<ImagePreviewProps> = ({
  hoveredImage,
  projectPath,
  currentFilePath,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const prevUrlRef = React.useRef<string | null>(null)

  useEffect(() => {
    if (!hoveredImage) {
      setImageUrl(null)
      setLoadingState('idle')
      prevUrlRef.current = null
      return
    }

    // If we're hovering over the same URL, don't reload (just position changed)
    if (hoveredImage.url === prevUrlRef.current) {
      return
    }

    prevUrlRef.current = hoveredImage.url

    const loadImage = async () => {
      setLoadingState('loading')

      try {
        const path = hoveredImage.url

        // Check if it's a remote URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
          setImageUrl(path)
          setLoadingState('success')
          return
        }

        // For local paths, resolve to absolute path
        const absolutePath = await invoke<string>('resolve_image_path', {
          imagePath: path,
          projectRoot: projectPath,
          currentFilePath,
        })

        // Convert to asset protocol URL
        const assetUrl = convertFileSrc(absolutePath)
        setImageUrl(assetUrl)
        setLoadingState('success')
      } catch {
        // Fail silently - don't show error state
        setLoadingState('error')
      }
    }

    void loadImage()
  }, [hoveredImage?.url, projectPath, currentFilePath, hoveredImage])

  // Don't render anything if no hovered image or if error state (fail silently)
  if (!hoveredImage || loadingState === 'error') {
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
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        padding: '12px',
        zIndex: 1000,
        opacity: loadingState === 'idle' ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        backdropFilter: 'blur(10px)',
      }}
    >
      {loadingState === 'loading' && (
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
              border: '2px solid rgba(0, 0, 0, 0.1)',
              borderTopColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {loadingState === 'success' && imageUrl && (
        <img
          src={imageUrl}
          alt="Preview"
          style={{
            maxWidth: '100%',
            maxHeight: '276px', // 300px - (12px padding * 2)
            objectFit: 'contain',
            display: 'block',
          }}
          onError={() => {
            setLoadingState('error')
          }}
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

// Memoize to prevent unnecessary re-renders when parent re-renders
export const ImagePreview = React.memo(ImagePreviewComponent)
