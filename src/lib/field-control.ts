/**
 * Which control the frontmatter form uses for a field. `FrontmatterField`
 * renders from it and the project settings' schema view describes it, so the
 * two always agree.
 */

import { FieldType, type SchemaField } from './schema'
import type { FieldMappings } from './files/sorting'

export type FieldControl =
  | 'boolean'
  | 'number'
  | 'date'
  | 'enum'
  | 'references'
  | 'images'
  | 'json'
  | 'list'
  | 'image'
  | 'email'
  | 'url'
  | 'reference'
  | 'title'
  | 'description'
  | 'text'

/** How each control is described to the writer */
export const FIELD_CONTROL_LABELS: Record<FieldControl, string> = {
  boolean: 'Switch',
  number: 'Number input',
  date: 'Date picker',
  enum: 'Dropdown',
  references: 'Entry picker, several',
  images: 'Image picker, several',
  json: 'Edited as JSON',
  list: 'Tag input',
  image: 'Image picker',
  email: 'Email input',
  url: 'URL input',
  reference: 'Entry picker',
  title: 'Title text box',
  description: 'Text area',
  text: 'Text input',
}

/**
 * The control for a field. The first match wins:
 * - Array references come before complex arrays, which would otherwise be
 *   JSON. An array of references whose collection the Zod parser didn't find
 *   has no `subReference`, so it's JSON.
 * - Arrays of images get an image picker each; arrays of anything else but
 *   strings and numbers (dates, objects, tuples) are JSON.
 * - Every typed control comes before the title and description mappings, so
 *   those only replace plain string fields.
 * - A field with no schema is text, except a string array, which is inferred
 *   from its value.
 */
export function fieldControl(
  name: string,
  field: SchemaField | undefined,
  value: unknown,
  mappings: Pick<FieldMappings, 'title' | 'description'>
): FieldControl {
  const type = field?.type ?? FieldType.String
  const isArray = type === FieldType.Array
  const isArrayReference = isArray && Boolean(field?.subReference)
  const isComplexArray =
    isArray &&
    !isArrayReference &&
    field?.subType !== undefined &&
    field.subType !== FieldType.String &&
    field.subType !== FieldType.Number &&
    field.subType !== FieldType.Integer

  if (type === FieldType.Boolean) return 'boolean'
  if (type === FieldType.Number || type === FieldType.Integer) return 'number'
  if (type === FieldType.Date) return 'date'
  if (type === FieldType.Enum && field?.enumValues) return 'enum'
  if (isArrayReference) return 'references'
  if (isComplexArray && field?.subType === FieldType.Image) return 'images'
  if (isComplexArray || type === FieldType.Object) return 'json'
  if (
    isArray ||
    (!field &&
      Array.isArray(value) &&
      value.every((item: unknown) => typeof item === 'string'))
  ) {
    return 'list'
  }
  if (type === FieldType.Image) return 'image'
  if (type === FieldType.Email) return 'email'
  if (type === FieldType.URL) return 'url'
  if (type === FieldType.Reference) return 'reference'
  if (name === mappings.title) return 'title'
  if (name === mappings.description) return 'description'
  return 'text'
}
