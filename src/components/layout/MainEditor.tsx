import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Editor } from '../editor'
import { openProjectViaDialog } from '../../lib/projects/actions'
import { Button } from '../ui/button'

// Welcome screen component for better organization
const WelcomeScreen: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center text-muted-foreground flex flex-col gap-4">
      <h2 className="m-0 text-2xl font-light">Welcome to Astro Editor</h2>
      <p className="m-0 text-sm">
        Select a project folder to get started, then choose a file to edit.
      </p>
      <Button
        onClick={() => void openProjectViaDialog()}
        className="self-center"
        variant="outline"
        size="sm"
        title="Open Project"
      >
        Open Project
      </Button>
    </div>
  </div>
)

export const MainEditor: React.FC = () => {
  // PERFORMANCE FIX: Use specific selector instead of currentFile object to avoid cascade
  const hasCurrentFile = useEditorStore(state => !!state.currentFile)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--editor-color-background)]">
        {hasCurrentFile ? <Editor /> : <WelcomeScreen />}
      </div>
    </div>
  )
}
