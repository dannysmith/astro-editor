import { FieldType, type SchemaField } from '../schema'
import { setNestedValue } from '../object-utils'
import type { FieldMappings } from './sorting'

/**
 * The frontmatter for a new file, in schema order: the placeholder title,
 * today for the published date, and for other required fields only a value
 * that's always valid without being a guess: off for a switch, today for a
 * date, and an empty list unless it needs items. Other required fields (text,
 * numbers, enums, references, images) are left out, so the file holds nothing
 * the writer didn't choose: the panel marks them required, and the site's
 * build names them until they're filled in. Fields inside an object are left
 * out too, because the schema doesn't say whether the object is required.
 */
export function newFileFrontmatter(
  fields: SchemaField[],
  mappings: Pick<FieldMappings, 'title' | 'publishedDate'>,
  title: string,
  today: string
): Record<string, unknown> {
  const publishedDates = [mappings.publishedDate].flat()
  let frontmatter: Record<string, unknown> = {}

  for (const field of fields) {
    const value = newFieldValue(field)
    if (value !== undefined) {
      frontmatter = setNestedValue(frontmatter, field.name, value)
    }
  }
  return frontmatter

  function newFieldValue(field: SchemaField): unknown {
    if (field.name === mappings.title) return title
    if (field.type === FieldType.Date && publishedDates.includes(field.name)) {
      return today
    }
    if (!field.required || field.name.includes('.')) return undefined
    switch (field.type) {
      case FieldType.Boolean:
        return false
      case FieldType.Date:
        return today
      case FieldType.Array:
        return field.constraints?.minItems ? undefined : []
      default:
        return undefined
    }
  }
}
