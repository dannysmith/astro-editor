import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { deserializeCompleteSchema } from '../../lib/schema'
import { camelCaseToTitleCase } from '../../lib/utils'
import { FrontmatterField } from './fields'
import { getEffectiveSettings } from '../../lib/project-registry/effective-settings'
import type { Collection } from '@/types'

export const FrontmatterPanel: React.FC = () => {
  const { currentFile, frontmatter } = useEditorStore()
  const { projectPath, currentProjectSettings } = useProjectStore()

  // Use TanStack Query to fetch collections
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  // Get schema for current collection
  const currentCollection: Collection | null = currentFile
    ? collections.find(c => c.name === currentFile.collection) || null
    : null

  // Get schema from Rust backend
  const schema = React.useMemo(() => {
    if (!currentCollection?.complete_schema) return null

    const parsed = deserializeCompleteSchema(currentCollection.complete_schema)

    if (import.meta.env.DEV && parsed) {
      // eslint-disable-next-line no-console
      console.log(
        `[Schema] Loaded complete schema for: ${parsed.collectionName}`
      )
    }

    return parsed
  }, [currentCollection])

  // Get all fields to display
  const allFields = React.useMemo(() => {
    if (schema) {
      // Get title field name from collection-specific settings
      const effectiveSettings = currentFile
        ? getEffectiveSettings(currentProjectSettings, currentFile.collection)
        : getEffectiveSettings(currentProjectSettings)
      const titleFieldName = effectiveSettings.frontmatterMappings.title

      // Start with all schema fields
      const schemaFields = schema.fields.map(field => ({
        fieldName: field.name,
        schemaField: field,
        value: frontmatter[field.name], // Don't auto-assign defaults that will get saved
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
  }, [frontmatter, schema, currentProjectSettings, currentFile])

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
    <div className="h-full flex flex-col">
      <div className="flex-1 p-4 overflow-y-auto">
        {currentFile ? (
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
                    <h3 className="text-sm font-medium text-foreground pt-2">
                      {camelCaseToTitleCase(
                        parentPath!.split('.').pop() || parentPath!
                      )}
                    </h3>

                    {/* Nested fields with indentation */}
                    <div className="pl-4 border-l-2 border-border space-y-4">
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
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No frontmatter fields found.
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Select a file to edit its frontmatter.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
