import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { shownFrontmatter, useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { deserializeCompleteSchema } from '../../lib/schema'
import { openInIde } from '../../lib/ide'
import { Button } from '../ui/button'
import { FrontmatterField } from './fields'
import { fieldMappings } from '../../lib/project-scan'
import {
  frontmatterTree,
  type FrontmatterNode,
} from '../../lib/frontmatter-tree'
import type { Collection } from '@/types'

/**
 * Shown in place of the fields when the open file's frontmatter isn't valid
 * YAML. The body can still be edited, and saving leaves the frontmatter's
 * text as it is
 */
const UnreadableFrontmatter: React.FC<{ error: string; filePath: string }> = ({
  error,
  filePath,
}) => {
  const ideCommand = useProjectStore(
    state => state.globalSettings?.general.ideCommand
  )
  return (
    <div className="flex flex-col items-start gap-3">
      <h3 className="m-0 flex items-start gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        Couldn’t read this file’s frontmatter
      </h3>
      <p className="m-0 font-mono text-xs break-words text-muted-foreground">
        {error}
      </p>
      <p className="m-0 text-sm text-muted-foreground">
        You can still edit the text. Fix the frontmatter in another editor and
        its fields will appear here.
      </p>
      {ideCommand && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openInIde(filePath, ideCommand)}
        >
          <ExternalLink /> Open in IDE
        </Button>
      )}
    </div>
  )
}

/** The panel's fields, with each nested object as a titled, indented group */
const FrontmatterNodes: React.FC<{
  nodes: FrontmatterNode[]
  collectionName: string
}> = ({ nodes, collectionName }) =>
  nodes.map(node =>
    node.kind === 'field' ? (
      <FrontmatterField
        key={node.name}
        name={node.name}
        label={node.label}
        field={node.field}
        collectionName={collectionName}
      />
    ) : (
      <div key={node.path} className="space-y-4">
        <h3 className="pt-2 text-sm font-medium text-foreground">
          {node.heading}
        </h3>
        <div className="space-y-4 border-l-2 border-border pl-4">
          <FrontmatterNodes
            nodes={node.children}
            collectionName={collectionName}
          />
        </div>
      </div>
    )
  )

export const FrontmatterPanel: React.FC = () => {
  // Object subscriptions need shallow to prevent re-renders on reference changes
  const currentFile = useEditorStore(useShallow(state => state.currentFile))
  // Only the keys: each field follows its own value, so typing in one doesn't
  // re-render the panel
  const frontmatterKeys = useEditorStore(
    useShallow(state => Object.keys(shownFrontmatter(state)))
  )
  const loadError = useEditorStore(state => state.loadError)
  const frontmatterError = useEditorStore(state => state.frontmatterError)
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: collections = [] } = useCollectionsQuery(projectPath)

  // Get schema for current collection
  const currentCollection: Collection | null = currentFile
    ? collections.find(c => c.name === currentFile.collection) || null
    : null

  // Get schema from Rust backend
  const completeSchema = currentCollection?.completeSchema
  const schema = completeSchema
    ? deserializeCompleteSchema(completeSchema)
    : null

  const nodes = frontmatterTree(
    schema,
    frontmatterKeys,
    fieldMappings(currentCollection ?? undefined).title
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {currentFile && loadError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This file couldn’t be opened.
          </p>
        ) : currentFile && frontmatterError ? (
          <UnreadableFrontmatter
            error={frontmatterError}
            filePath={currentFile.path}
          />
        ) : currentFile ? (
          nodes.length > 0 ? (
            <div className="space-y-6">
              <FrontmatterNodes
                nodes={nodes}
                collectionName={currentFile.collection}
              />
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No frontmatter fields found.
              </p>
            </div>
          )
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Select a file to edit its frontmatter.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
