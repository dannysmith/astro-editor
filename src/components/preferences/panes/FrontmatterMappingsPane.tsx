import React, { useMemo } from 'react'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { usePreferences } from '../../../hooks/usePreferences'
import { useCollectionsQuery } from '../../../hooks/queries/useCollectionsQuery'
import { deserializeCompleteSchema, FieldType } from '../../../lib/schema'
import type { SchemaField } from '../../../lib/schema'

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <FieldGroup>{children}</FieldGroup>
  </div>
)

export const FrontmatterMappingsPane: React.FC = () => {
  const { currentProjectSettings, updateProject, projectPath, projectName } =
    usePreferences()

  // Get collections from TanStack Query
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  // Get all schema fields from all collections
  const allFields = useMemo(() => {
    const fieldMap = new Map<string, SchemaField>()

    collections.forEach(collection => {
      if (collection.complete_schema) {
        try {
          const schema = deserializeCompleteSchema(collection.complete_schema)
          if (schema) {
            schema.fields.forEach(field => {
              fieldMap.set(field.name, field)
            })
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to parse schema for ${collection.name}:`, error)
        }
      }
    })

    return fieldMap
  }, [collections])

  // Filter fields by type
  const dateFields = useMemo(
    () =>
      Array.from(allFields.values()).filter(
        field => field.type === FieldType.Date
      ),
    [allFields]
  )

  const textFields = useMemo(
    () =>
      Array.from(allFields.values()).filter(
        field => field.type === FieldType.String
      ),
    [allFields]
  )

  const booleanFields = useMemo(
    () =>
      Array.from(allFields.values()).filter(
        field => field.type === FieldType.Boolean
      ),
    [allFields]
  )

  const handleMappingChange = (
    key: 'publishedDate' | 'title' | 'description' | 'draft',
    value: string
  ) => {
    void updateProject({
      frontmatterMappings: {
        ...currentProjectSettings?.frontmatterMappings,
        [key]: value || undefined, // Remove empty strings
      },
    })
  }

  const renderFieldSelect = (
    value: string | undefined,
    onChange: (value: string) => void,
    fields: SchemaField[],
    placeholder: string
  ) => (
    <Select
      value={value || 'none'}
      onValueChange={val => onChange(val === 'none' ? '' : val)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">Use default</span>
        </SelectItem>
        {fields.map(field => (
          <SelectItem key={field.name} value={field.name}>
            {field.name}
            {!field.required && (
              <span className="text-muted-foreground ml-1">(optional)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4 mb-6">
        <h2 className="text-base font-semibold mb-1">
          Project-Level Frontmatter Mappings
          {projectName && (
            <span className="text-muted-foreground font-normal ml-2">
              · {projectName}
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure default frontmatter field mappings for this project.
          Collection-specific overrides can be configured in the Collections
          tab.
        </p>
      </div>

      <SettingsSection title="Frontmatter Field Mappings">
        <p className="text-sm text-muted-foreground -mt-3 mb-2">
          Map special frontmatter fields used by the app to your{' '}
          <span className="font-medium">{projectName}</span> schema field names.
          Only fields that exist in your collection schemas are shown.
        </p>

        <Field>
          <FieldLabel>Published Date Field</FieldLabel>
          <FieldContent>
            {renderFieldSelect(
              currentProjectSettings?.frontmatterMappings?.publishedDate,
              value => handleMappingChange('publishedDate', value),
              dateFields,
              'Select date field'
            )}
            <FieldDescription>
              Field used for ordering files in the list (default: date, pubDate,
              or publishedDate)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Title Field</FieldLabel>
          <FieldContent>
            {renderFieldSelect(
              currentProjectSettings?.frontmatterMappings?.title,
              value => handleMappingChange('title', value),
              textFields,
              'Select text field'
            )}
            <FieldDescription>
              Field that gets special treatment in the frontmatter panel
              (default: title)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Description Field</FieldLabel>
          <FieldContent>
            {renderFieldSelect(
              currentProjectSettings?.frontmatterMappings?.description,
              value => handleMappingChange('description', value),
              textFields,
              'Select text field'
            )}
            <FieldDescription>
              Field that gets special treatment in the frontmatter panel
              (default: description)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Draft Field</FieldLabel>
          <FieldContent>
            {renderFieldSelect(
              currentProjectSettings?.frontmatterMappings?.draft,
              value => handleMappingChange('draft', value),
              booleanFields,
              'Select boolean field'
            )}
            <FieldDescription>
              Field that shows a draft marker in the file list (default: draft)
            </FieldDescription>
          </FieldContent>
        </Field>

        {collections.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 border rounded-lg">
            No collections found. Field options will appear when a project with
            collections is loaded.
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
