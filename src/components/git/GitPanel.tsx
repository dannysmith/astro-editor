import React from 'react'

/**
 * The right sidebar's Git tab, for projects with the experimental Git panel
 * switched on in Project Settings.
 */
export const GitPanel: React.FC = () => (
  <div className="flex h-full flex-col">
    <div className="flex-1 overflow-y-auto p-4">
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </p>
    </div>
  </div>
)
