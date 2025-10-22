import { useState, useEffect, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { findImageUrlsAndPathsInText } from '../../lib/editor/urls/detection'

export interface HoveredImage {
  url: string
  from: number
  to: number
}

/**
 * Hook to track when the user hovers over an image URL with Alt key pressed
 *
 * @param view - CodeMirror EditorView instance
 * @param isAltPressed - Whether Alt key is currently pressed
 * @returns Currently hovered image URL info, or null
 */
export const useImageHover = (
  view: EditorView | null,
  isAltPressed: boolean
): HoveredImage | null => {
  const [hoveredImage, setHoveredImage] = useState<HoveredImage | null>(null)

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!view || !isAltPressed) {
        setHoveredImage(null)
        return
      }

      try {
        // Get document position from mouse coordinates
        const pos = view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        })

        if (pos === null) {
          setHoveredImage(null)
          return
        }

        // Get the line containing this position
        const line = view.state.doc.lineAt(pos)
        const lineText = line.text
        const lineStart = line.from

        // Find all image URLs and paths in this line
        const imageUrls = findImageUrlsAndPathsInText(lineText, lineStart)

        // Check if cursor is within any image URL range
        const hoveredUrl = imageUrls.find(
          urlMatch => pos >= urlMatch.from && pos <= urlMatch.to
        )

        if (hoveredUrl) {
          // Only update if the URL changed (avoid re-renders on position changes)
          setHoveredImage(prev => {
            if (prev?.url === hoveredUrl.url) {
              return prev // Same URL, don't create new object
            }
            return {
              url: hoveredUrl.url,
              from: hoveredUrl.from,
              to: hoveredUrl.to,
            }
          })
        } else {
          setHoveredImage(null)
        }
      } catch {
        // Silently fail if position is out of bounds
        setHoveredImage(null)
      }
    },
    [view, isAltPressed]
  )

  useEffect(() => {
    if (!view) return

    // Get the editor DOM element
    const editorDom = view.dom

    // Add mouse move listener
    editorDom.addEventListener('mousemove', handleMouseMove)

    // Clear hovered image when Alt is released
    if (!isAltPressed) {
      setHoveredImage(null)
    }

    return () => {
      editorDom.removeEventListener('mousemove', handleMouseMove)
    }
  }, [view, isAltPressed, handleMouseMove])

  // Clear on mouse leave
  useEffect(() => {
    if (!view) return

    const editorDom = view.dom

    const handleMouseLeave = () => {
      setHoveredImage(null)
    }

    editorDom.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      editorDom.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [view])

  return hoveredImage
}
