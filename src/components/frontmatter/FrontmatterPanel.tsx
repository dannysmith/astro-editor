import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { shownFrontmatter, useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { deserializeCompleteSchema } from '../../lib/schema'
import { camelCaseToTitleCase } from '../../lib/utils'
import { openInIde } from '../../lib/ide'
import { Button } from '../ui/button'
import { FrontmatterField } from './fields'
import { fieldMappings } from '../../lib/project-scan'
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

export const FrontmatterPanel: React.FC = () => {
  // Object subscriptions need shallow to prevent re-renders on reference changes
  const currentFile = useEditorStore(useShallow(state => state.currentFile))
  const frontmatter = useEditorStore(useShallow(shownFrontmatter))
  const loadError = useEditorStore(state => state.loadError)
  const frontmatterError = useEditorStore(state => state.frontmatterError)
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: collections = [] } = useCollectionsQuery(projectPath)

  // Get schema for current collection
  const currentCollection: Collection | null = currentFile
    ? collections.find(c => c.name === currentFile.collection) || null
    : null

  // Get schema from Rust backend
  const schema = React.useMemo(() => {
    if (!currentCollection?.completeSchema) return null

    const parsed = deserializeCompleteSchema(currentCollection.completeSchema)

    return parsed
  }, [currentCollection])

  // Get all fields to display
  const allFields = React.useMemo(() => {
    if (schema) {
      // The collection's title field goes first
      const titleFieldName = fieldMappings(currentCollection ?? undefined).title

      // Start with all schema fields. Schema defaults are only shown as a hint
      // (FieldWrapper), never put into frontmatter: anything in frontmatter gets
      // saved, which would write values the author never set.
      const schemaFields = schema.fields.map(field => ({
        fieldName: field.name,
        schemaField: field,
        value: frontmatter[field.name],
      }))

      // Reorder: title field first, then other schema fields in order
      const titleField = schemaFields.find(f => f.fieldName === titleFieldName)
      const otherSchemaFields = schemaFields.filter(
        f => f.fieldName !== titleFieldName
      )
      const orderedSchemaFields = titleField
        ? [titleField, ...otherSchemaFields]
        : schemaFields

      // Add any extra frontmatter fields that aren't in the schema
      const schemaFieldNames = new Set(schema.fields.map(f => f.name))

      // Filter out parent object keys if their nested properties exist in schema
      // e.g., exclude "metadata" if schema has "metadata.category", "metadata.priority", etc.
      const extraFields = Object.keys(frontmatter)
        .filter(key => {
          // If the key is in the schema, it's not an extra field
          if (schemaFieldNames.has(key)) return false

          // Check if this key is a parent path for any schema fields
          // e.g., if key is "metadata" and schema has "metadata.category", exclude it
          const isParentPath = schema.fields.some(f =>
            f.name.startsWith(`${key}.`)
          )
          if (isParentPath) return false

          return true
        })
        .sort()
        .map(fieldName => ({
          fieldName,
          schemaField: undefined,
          value: frontmatter[fieldName],
        }))

      return [...orderedSchemaFields, ...extraFields]
    } else {
      // No schema available, just show existing frontmatter fields
      return Object.keys(frontmatter).map(fieldName => ({
        fieldName,
        schemaField: undefined,
        value: frontmatter[fieldName],
      }))
    }
  }, [frontmatter, schema, currentCollection])

  // Group fields by parent path for nested object rendering
  const groupedFields = React.useMemo(() => {
    const groups: Map<string | null, typeof allFields> = new Map()

    for (const field of allFields) {
      const parentPath = field.schemaField?.parentPath ?? null
      if (!groups.has(parentPath)) {
        groups.set(parentPath, [])
      }
      groups.get(parentPath)!.push(field)
    }

    return groups
  }, [allFields])

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
          allFields.length > 0 ? (
            <div className="space-y-6">
              {/* Render top-level SCHEMA fields only */}
              {groupedFields
                .get(null)
                ?.filter(({ schemaField }) => schemaField !== undefined)
                .map(({ fieldName, schemaField }) => (
                  <FrontmatterField
                    key={fieldName}
                    name={fieldName}
                    label={camelCaseToTitleCase(fieldName)}
                    field={schemaField}
                    collectionName={currentFile.collection}
                  />
                ))}

              {/* Render nested field groups */}
              {Array.from(groupedFields.entries())
                .filter(([parentPath]) => parentPath !== null)
                .map(([parentPath, fields]) => (
                  <div key={parentPath} className="space-y-4">
                    {/* Parent section header */}
                    <h3 className="pt-2 text-sm font-medium text-foreground">
                      {camelCaseToTitleCase(
                        parentPath!.split('.').pop() || parentPath!
                      )}
                    </h3>

                    {/* Nested fields with indentation */}
                    <div className="space-y-4 border-l-2 border-border pl-4">
                      {fields.map(({ fieldName, schemaField }) => (
                        <FrontmatterField
                          key={fieldName}
                          name={fieldName}
                          label={
                            schemaField?.label ||
                            camelCaseToTitleCase(
                              fieldName.split('.').pop() || fieldName
                            )
                          }
                          field={schemaField}
                          collectionName={currentFile.collection}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {/* Render extra fields (not in schema) at the very end, alphabetically */}
              {groupedFields
                .get(null)
                ?.filter(({ schemaField }) => schemaField === undefined)
                .map(({ fieldName, schemaField }) => (
                  <FrontmatterField
                    key={fieldName}
                    name={fieldName}
                    label={camelCaseToTitleCase(fieldName)}
                    field={schemaField}
                    collectionName={currentFile.collection}
                  />
                ))}
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
