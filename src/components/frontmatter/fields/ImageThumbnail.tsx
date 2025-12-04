import React, { useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { commands } from '@/lib/bindings'
import { useProjectStore } from '../../../store/projectStore'
import { useEditorStore } from '../../../store/editorStore'

interface ImageThumbnailProps {
  path: string
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ path }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const projectPath = useProjectStore(state => state.projectPath)
  const currentFile = useEditorStore(state => state.currentFile)

  useEffect(() => {
    if (!path || !projectPath) {
      return
    }

    let cancelled = false

    const loadImage = async () => {
      setLoadingState('loading')

      try {
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
          currentFile?.path ?? null
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
    // Keep cached state to prevent flicker during transitions
    return () => {
      cancelled = true
    }
  }, [path, projectPath, currentFile?.path])

  // Don't render anything if no path or if error state (fail silently)
  if (!path || loadingState === 'error') {
    return null
  }

  return (
    <div className="relative w-full max-w-[200px]">
      {loadingState === 'loading' && (
        <div className="flex items-center justify-center h-24 bg-muted/30 rounded-md border border-border">
          <div className="size-6 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
        </div>
      )}

      {loadingState === 'success' && imageUrl && (
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-[150px] object-contain rounded-md border border-border"
          onError={() => {
            setLoadingState('error')
          }}
        />
      )}
    </div>
  )
}
