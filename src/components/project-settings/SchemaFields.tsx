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
import { StatusIcon, WithCode } from './Problems'

/** What the form shows without a complete schema */
function schemaNote(collection: Collection, hasFields: boolean): string | null {
  const ownFields =
    "the form shows each file's own fields as text, without types, defaults or required markers"
  switch (collection.schemaStatus) {
    case 'complete':
      return null
    case 'none':
      return `This collection has no schema, so ${ownFields}.`
    case 'notGenerated':
    case 'unreadable': {
      const why =
        collection.schemaStatus === 'notGenerated'
          ? "Astro hasn't generated this collection's schema"
          : "This collection's generated schema couldn't be read"
      return hasFields
        ? `${why}, so Astro Editor only knows these fields, from the config's \`image()\` and \`reference()\`. For the rest, ${ownFields}.`
        : `${why}, so ${ownFields}.`
    }
  }
}

/** Why a field can't be edited with a proper control, if it can't */
function limitation(field: SchemaField, control: string): string | null {
  if (field.type === FieldType.Unknown) {
    return "Its type couldn't be read, so it's edited as text."
  }
  if (control === 'yaml') {
    return "The form has no control for this shape, so it's edited as YAML."
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
    <div className="space-y-3">
      {note && (
        <p className="text-sm text-muted-foreground">
          <WithCode text={note} />
        </p>
      )}
      {fields.length > 0 && (
        <div className="divide-y rounded-lg border">
          {fields.map(field => {
            const control = fieldControl(field.name, field, undefined, mappings)
            const problem = limitation(field, control)
            const details = describeConstraints(field)
            return (
              <div key={field.name} className="space-y-1 px-3 py-2 text-sm">
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
                    {problem && (
                      <StatusIcon level="warning" className="size-3.5" />
                    )}
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
        </div>
      )}
    </div>
  )
}
