import React, { useState, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

export const StatusBar: React.FC = () => {
  console.log('[PERF] StatusBar RENDER')

  const currentFile = useEditorStore(state => state.currentFile)

  const {
    sidebarVisible,
    frontmatterPanelVisible,
    distractionFreeBarsHidden,
    showBars,
  } = useUIStore()

  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [isDirty, setIsDirty] = useState(false)

  // Poll for word/char count and isDirty using getState() to avoid subscribing
  // to editorContent/isDirty which would cause re-renders that interrupt CSS transitions
  useEffect(() => {
    const interval = setInterval(() => {
      const { editorContent, isDirty: currentIsDirty } =
        useEditorStore.getState()
      const words = editorContent.split(/\s+/).filter(w => w.length > 0).length
      setWordCount(words)
      setCharCount(editorContent.length)
      setIsDirty(currentIsDirty)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const bothPanelsHidden = !sidebarVisible && !frontmatterPanelVisible

  return (
    <div
      className={cn(
        'flex justify-between items-center px-4 py-1 text-xs min-h-6 border-t',
        bothPanelsHidden
          ? 'bg-[var(--editor-color-background)] border-transparent text-muted-foreground/40'
          : 'bg-gray-50 dark:bg-black border-border text-muted-foreground',
        distractionFreeBarsHidden &&
          bothPanelsHidden &&
          'opacity-0 transition-opacity duration-300'
      )}
      onMouseEnter={showBars}
    >
      <div className="flex items-center">
        {currentFile && (
          <span>
            {currentFile.name}.{currentFile.extension}
            {isDirty && <span> •</span>}
          </span>
        )}
      </div>

      <div className="flex gap-4">
        {currentFile && (
          <>
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </>
        )}
      </div>
    </div>
  )
}
