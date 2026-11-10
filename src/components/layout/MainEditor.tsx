import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import { Editor } from '../editor'
import { showProjectList } from '../../lib/projects/actions'
import { Button } from '../ui/button'
import { useProjectStore } from '@/store/projectStore'

// Welcome screen component for better organization
const WelcomeScreen: React.FC = () => {
  const projectPath = useProjectStore(state => state.projectPath)
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col gap-4 text-center text-muted-foreground">
        <h2 className="m-0 text-2xl font-light">Welcome to Astro Editor</h2>
        <p className="m-0 text-sm">
          {projectPath == null
            ? 'Select a project folder to get started, then choose a file to edit.'
            : 'Choose a file to edit.'}
        </p>
        {projectPath == null && (
          <Button
            onClick={() => showProjectList()}
            className="self-center"
            variant="outline"
            size="sm"
            title="Open Project"
          >
            Open Project
          </Button>
        )}
      </div>
    </div>
  )
}

export const MainEditor: React.FC = () => {
  // A boolean, not currentFile, so changes to the file object don't re-render this
  const hasCurrentFile = useEditorStore(state => !!state.currentFile)
  const typewriterModeEnabled = useUIStore(state => state.typewriterModeEnabled)

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex-1 overflow-x-hidden overflow-y-auto bg-editor-background${typewriterModeEnabled ? ' no-scrollbar' : ''}`}
      >
        {hasCurrentFile ? <Editor /> : <WelcomeScreen />}
      </div>
    </div>
  )
}
