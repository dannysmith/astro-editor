import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
import { parseSchemaJson } from '../../lib/schema'
import { camelCaseToTitleCase } from '../../lib/utils'
import { FrontmatterField } from './fields'

interface Collection {
  name: string
  path: string
  schema?: string
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

  const schema = currentCollection?.schema
    ? parseSchemaJson(currentCollection.schema)
    : null

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
      // Start with all schema fields
      const schemaFields = schema.fields.map(field => ({
        fieldName: field.name,
        schemaField: field,
        value: frontmatter[field.name], // Don't auto-assign defaults that will get saved
      }))

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

      return [...schemaFields, ...extraFields]
    } else {
      // No schema available, just show existing frontmatter fields
      return Object.keys(frontmatter).map(fieldName => ({
        fieldName,
        schemaField: undefined,
        value: frontmatter[fieldName],
      }))
    }
  }, [frontmatter, schema])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-4 overflow-y-auto">
        {currentFile ? (
          allFields.length > 0 ? (
            <div className="space-y-6">
              {allFields.map(({ fieldName, schemaField }) => (
                <FrontmatterField
                  key={fieldName}
                  name={fieldName}
                  label={camelCaseToTitleCase(fieldName)}
                  field={schemaField}
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
