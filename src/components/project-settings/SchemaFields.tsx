import type { Collection } from '@/lib/bindings'
import {
  FieldType,
  type CompleteSchema,
  type SchemaField,
} from '../../lib/schema'
import { fieldControl, FIELD_CONTROL_LABELS } from '../../lib/field-control'
import { fieldMappings } from '../../lib/project-scan'
import {
  describeConstraints,
  describeFieldType,
} from '../../lib/project-settings/describe'
import { isUnreadLoader } from '../../lib/project-settings/status'
import { StatusIcon, WithCode } from './Problems'
import { SettingsGroup } from './Setting'

/**
 * What's known without a complete schema. A collection's page says what that
 * means for the form at the top, so this only says what's here; collections
 * AE doesn't edit have nothing at the top, so they get what to do.
 */
function schemaNote(collection: Collection, hasFields: boolean): string | null {
  const edited = collection.kind !== 'data' && !isUnreadLoader(collection)
  switch (collection.schemaStatus) {
    case 'complete':
      return null
    case 'none':
      return 'It has no schema.'
    case 'notGenerated':
    case 'unreadable':
      if (!edited) {
        return "Astro's generated schema for it is missing or couldn't be read. Run `astro sync` in the project to generate it."
      }
      return hasFields
        ? 'Only the fields using `image()` or `reference()` are known.'
        : 'No fields are known.'
  }
}

/** Why a field can't be edited with a proper control, if it can't */
function limitation(field: SchemaField, control: string): string | null {
  if (field.type === FieldType.Unknown) return "Its type couldn't be read."
  if (control === 'json') {
    return "There's no control for this type of field."
  }
  return null
}

/** Each field of a collection's schema as AE read it, and how the form shows it */
export function SchemaFields({
  collection,
  schema,
}: {
  collection: Collection
  schema: CompleteSchema | null
}) {
  const fields = schema?.fields ?? []
  const note = schemaNote(collection, fields.length > 0)
  const mappings = fieldMappings(collection)

  return (
    <SettingsGroup
      title="Schema"
      note={
        fields.length > 0 &&
        `${fields.length} ${fields.length === 1 ? 'field' : 'fields'}`
      }
    >
      {note && (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          <WithCode text={note} />
        </p>
      )}
      {fields.map(field => {
        const control = fieldControl(field.name, field, undefined, mappings)
        const problem = limitation(field, control)
        const details = describeConstraints(field)
        return (
          <div key={field.name} className="space-y-1 px-4 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <code className="font-mono text-xs font-medium text-heading">
                  {field.name}
                </code>
                <span className="text-xs text-muted-foreground">
                  <WithCode text={describeFieldType(field)} />
                  {field.required && (
                    <span className="text-required"> · required</span>
                  )}
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {problem && <StatusIcon level="warning" className="size-3.5" />}
                {FIELD_CONTROL_LABELS[control]}
              </span>
            </div>
            {details.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <WithCode text={details.join(' · ')} />
              </p>
            )}
            {field.description && (
              <p className="text-xs">{field.description}</p>
            )}
            {problem && <p className="text-xs text-warning">{problem}</p>}
          </div>
        )
      })}
    </SettingsGroup>
  )
}
