import { booleanDefault, FieldType, type SchemaField } from '../schema'

type Values = Record<string, unknown>

/**
 * The open file's frontmatter as it was first loaded: its values and the exact
 * text they were read from. Editing a field re-serialises the whole block, so
 * a save whose values are back to these writes this text instead, and a field
 * changed and changed back leaves the file as it was. It's kept across our own
 * saves, which rewrite the text on disk. It isn't moved by changes made
 * outside the app either, which is safe: the text is only written when the
 * values match exactly what it reads back as.
 */
export interface FrontmatterBaseline {
  values: Values
  raw: string
}

const isPlainObject = (value: unknown): value is Values =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Deep equality for parsed YAML values; key order in objects doesn't count */
function sameValues(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameValues(item, b[i]))
    )
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length &&
      keys.every(key => key in b && sameValues(a[key], b[key]))
    )
  }
  return a === b
}

/**
 * Whether a value for a key the file didn't have looks the same in the panel
 * as no value: a switch turned on and off again, showing its default. Any
 * other new key is a change. A new object counts only if it has keys and
 * each of them qualifies.
 */
function isUnset(value: unknown, path: string, fields: SchemaField[]): boolean {
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    return (
      entries.length > 0 &&
      entries.every(([key, v]) => isUnset(v, `${path}.${key}`, fields))
    )
  }
  const field = fields.find(f => f.name === path)
  return field?.type === FieldType.Boolean && value === booleanDefault(field)
}

function matches(
  values: Values,
  baseline: Values,
  fields: SchemaField[],
  prefix: string
): boolean {
  const keys = new Set([...Object.keys(values), ...Object.keys(baseline)])
  return [...keys].every(key => {
    const path = `${prefix}${key}`
    const value = values[key]
    const before = baseline[key]
    if (!(key in baseline)) return isUnset(value, path, fields)
    if (!(key in values)) return false
    if (isPlainObject(value) && isPlainObject(before)) {
      return matches(value, before, fields, `${path}.`)
    }
    return sameValues(value, before)
  })
}

/**
 * Whether the edited frontmatter is back to the baseline's values, so saving
 * can write the baseline's text unchanged. `fields` are the collection's
 * schema fields (flattened names, like `seo.noindex`), used to recognise a
 * switch left at its default.
 */
export function isBackToBaseline(
  frontmatter: Values,
  baseline: FrontmatterBaseline,
  fields: SchemaField[]
): boolean {
  return matches(frontmatter, baseline.values, fields, '')
}
