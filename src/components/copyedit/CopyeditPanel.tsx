import React from 'react'

/** The right sidebar's Copyedit tab: tools for editing prose. */
export const CopyeditPanel: React.FC = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="py-12 text-center text-sm text-muted-foreground">
          Copyedit tools will go here.
        </p>
      </div>
    </div>
  )
}
