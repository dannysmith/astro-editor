import React, { useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { commands } from '@/lib/bindings'
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
    const url = hoveredImage?.url
    if (!url) {
      return
    }

    // If we're hovering over the same URL, don't reload (just position changed)
    if (url === prevUrlRef.current) {
      return
    }

    prevUrlRef.current = url
    let cancelled = false

    const loadImage = async () => {
      setLoadingState('loading')

      try {
        const path = url

        // Check if it's a remote URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
          if (!cancelled) {
            setImageUrl(path)
            setLoadingState('success')
          }
          return
        }

        // For local paths, resolve to absolute path
        const result = await commands.resolveImagePath(
          path,
          projectPath,
          currentFilePath ?? null
        )
        if (result.status === 'error') {
          throw new Error(result.error)
        }

        if (!cancelled) {
          // Convert to asset protocol URL
          const assetUrl = convertFileSrc(result.data)
          setImageUrl(assetUrl)
          setLoadingState('success')
        }
      } catch {
        // Fail silently - don't show error state
        if (!cancelled) {
          setLoadingState('error')
        }
      }
    }

    void loadImage()

    // Cleanup: only set cancelled flag to prevent stale updates
    // Keep cached state (imageUrl, loadingState, prevUrlRef) to prevent flicker
    return () => {
      cancelled = true
    }
  }, [hoveredImage?.url, projectPath, currentFilePath])

  // Don't render anything if no hovered image or if error state (fail silently)
  if (!hoveredImage || loadingState === 'error') {
    return null
  }

  return (
    <div
      className="image-preview-container"
      style={{
        opacity: loadingState === 'idle' ? 0 : 1,
      }}
    >
      {loadingState === 'loading' && (
        <div className="image-preview-loading">
          <div className="image-preview-spinner" />
        </div>
      )}

      {loadingState === 'success' && imageUrl && (
        <img
          src={imageUrl}
          alt="Preview"
          className="image-preview-image"
          onError={() => {
            setLoadingState('error')
          }}
        />
      )}
    </div>
  )
}

export const ImagePreview = ImagePreviewComponent
