import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { parseSchemaJson, deserializeCompleteSchema } from '../../lib/schema'
import { parseJsonSchema } from '../../lib/parseJsonSchema'
import { camelCaseToTitleCase } from '../../lib/utils'
import { FrontmatterField } from './fields'

interface Collection {
  name: string
  path: string
  schema?: string
  json_schema?: string
  complete_schema?: string
}

export const FrontmatterPanel: React.FC = () => {
  const { currentFile, frontmatter } = useEditorStore()
  const { projectPath, currentProjectSettings } = useProjectStore()

  // Use TanStack Query to fetch collections
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings?.pathOverrides?.contentDirectory
  )

  // Get schema for current collection
  const currentCollection: Collection | null = currentFile
    ? collections.find(c => c.name === currentFile.collection) || null
    : null

  // Get schema - try complete_schema first, fall back to hybrid parsing
  const schema = React.useMemo(() => {
    if (!currentCollection) return null

    // NEW: Try complete schema from Rust backend
    if (currentCollection.complete_schema) {
      const parsed = deserializeCompleteSchema(
        currentCollection.complete_schema
      )

      if (parsed) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(
            `[Schema] Loaded complete schema for: ${parsed.collectionName}`
          )
        }
        return parsed
      }
    }

    // FALLBACK: Use old hybrid parsing for backwards compatibility
    // This will be removed once all projects regenerate schemas
    if (currentCollection.json_schema) {
      const parsed = parseJsonSchema(currentCollection.json_schema)

      if (parsed) {
        // Enhance with Zod reference metadata if available
        if (currentCollection.schema) {
          const zodSchema = parseSchemaJson(currentCollection.schema)

          if (zodSchema) {
            parsed.fields = parsed.fields.map(field => {
              const zodField = zodSchema.fields.find(z => z.name === field.name)

              if (zodField) {
                return {
                  ...field,
                  ...(zodField.reference && {
                    reference: zodField.reference,
                    referenceCollection: zodField.reference,
                  }),
                  ...(zodField.subReference && {
                    subReference: zodField.subReference,
                  }),
                }
              }

              return field
            })
          }
        }

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(
            `[Schema] Using fallback hybrid parsing for: ${currentCollection.name}`
          )
        }

        return parsed
      }
    }

    // Last resort: Zod-only parsing
    if (currentCollection.schema) {
      const parsed = parseSchemaJson(currentCollection.schema)
      if (parsed) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(
            `[Schema] Using Zod schema (fallback) for: ${currentCollection.name}`
          )
        }
        return parsed
      }
    }

    return null
  }, [currentCollection])

  // Listen for schema field order requests from editorStore
  React.useEffect(() => {
    const handleSchemaFieldOrderRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ collectionName: string }>
      const { collectionName } = customEvent.detail

      // Find the requested collection
      const requestedCollection = collections.find(
        c => c.name === collectionName
      )
      const requestedSchema = requestedCollection?.schema
        ? parseSchemaJson(requestedCollection.schema)
        : null

      // Extract field order from schema
      const fieldOrder =
        requestedSchema?.fields.map(field => field.name) || null

      // Send response
      window.dispatchEvent(
        new CustomEvent('schema-field-order-response', {
          detail: { fieldOrder },
        })
      )
    }

    window.addEventListener(
      'get-schema-field-order',
      handleSchemaFieldOrderRequest
    )
    return () =>
      window.removeEventListener(
        'get-schema-field-order',
        handleSchemaFieldOrderRequest
      )
  }, [collections])

  // Get all fields to display
  const allFields = React.useMemo(() => {
    if (schema) {
      // Get title field name from settings or default to 'title'
      const titleFieldName =
        currentProjectSettings?.frontmatterMappings?.title || 'title'

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
      const extraFields = Object.keys(frontmatter)
        .filter(key => !schemaFieldNames.has(key))
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
  }, [frontmatter, schema, currentProjectSettings])

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
              {/* Render top-level fields */}
              {groupedFields.get(null)?.map(({ fieldName, schemaField }) => (
                <FrontmatterField
                  key={fieldName}
                  name={fieldName}
                  label={camelCaseToTitleCase(fieldName)}
                  field={schemaField}
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
                        />
                      ))}
                    </div>
                  </div>
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
