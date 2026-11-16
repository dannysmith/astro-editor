import React from 'react'
import { HarperChecks } from './HarperChecks'
import { HarperIssues } from './HarperIssues'
import { HighlightsMenu } from './HighlightsMenu'

/**
 * The right sidebar's Copyedit tab: the part-of-speech highlights, Harper's
 * checks, and the issues Harper found.
 */
export const CopyeditPanel: React.FC = () => (
  <div className="flex h-full flex-col">
    <div className="flex-1 space-y-6 overflow-y-auto p-4">
      <HighlightsMenu />
      <HarperChecks />
      <HarperIssues />
    </div>
  </div>
)
