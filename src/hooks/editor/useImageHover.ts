import { useState, useEffect, type RefObject } from 'react'
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
 * Takes the view's ref rather than the view, because the view is created in an
 * effect after the first render; the ref is only read in effects. The mouse
 * listeners are only attached while Alt is held.
 *
 * @param viewRef - Ref to the CodeMirror EditorView instance
 * @param isAltPressed - Whether Alt key is currently pressed
 * @returns Currently hovered image URL info, or null
 */
export const useImageHover = (
  viewRef: RefObject<EditorView | null>,
  isAltPressed: boolean
): HoveredImage | null => {
  const [hoveredImage, setHoveredImage] = useState<HoveredImage | null>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view || !isAltPressed) return

    const handleMouseMove = (event: MouseEvent) => {
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

        // Find all image URLs and paths in this line
        const imageUrls = findImageUrlsAndPathsInText(line.text, line.from)

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
    }

    const handleMouseLeave = () => {
      setHoveredImage(null)
    }

    view.dom.addEventListener('mousemove', handleMouseMove)
    view.dom.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      view.dom.removeEventListener('mousemove', handleMouseMove)
      view.dom.removeEventListener('mouseleave', handleMouseLeave)
      // Releasing Alt forgets the image, so pressing it again starts afresh
      setHoveredImage(null)
    }
  }, [viewRef, isAltPressed])

  // Return null if Alt is not pressed, otherwise return the hovered image
  // This ensures the image preview disappears immediately when Alt is released
  return isAltPressed ? hoveredImage : null
}
