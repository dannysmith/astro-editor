/**
 * What the frontmatter panel shows, in order: fields, and groups of fields for
 * nested objects. It holds no values, since each field reads its own. Schema
 * defaults are only shown as a hint (`FieldWrapper`), never put into
 * frontmatter: anything in frontmatter gets saved, which would write values the
 * author never set.
 */

import type { CompleteSchema, SchemaField } from './schema'
import { camelCaseToTitleCase } from './utils'

export interface FrontmatterFieldNode {
  kind: 'field'
  /** The field's key, a dot path when it's nested */
  name: string
  label: string
  /** Undefined for a key in the file that the schema doesn't have */
  field?: SchemaField
}

export interface FrontmatterGroupNode {
  kind: 'group'
  /** The object's dot path */
  path: string
  heading: string
  children: FrontmatterNode[]
}

export type FrontmatterNode = FrontmatterFieldNode | FrontmatterGroupNode

const titleFromPath = (path: string) =>
  camelCaseToTitleCase(path.slice(path.lastIndexOf('.') + 1))

const keyNode = (name: string): FrontmatterFieldNode => ({
  kind: 'field',
  name,
  label: camelCaseToTitleCase(name),
})

/**
 * The panel's contents for a collection's schema and the keys in the file.
 * The title field comes first, then the schema's fields in its order, with a
 * nested object where its first field is. Keys the schema doesn't have come
 * last, alphabetically. Without a schema, the file's keys in their order.
 */
export function frontmatterTree(
  schema: CompleteSchema | null,
  frontmatterKeys: string[],
  titleField: string
): FrontmatterNode[] {
  if (!schema) return frontmatterKeys.map(keyNode)

  const root: FrontmatterNode[] = []
  const groups = new Map<string, FrontmatterGroupNode>()

  // The list a nested path's fields go in, adding its groups the first time
  const childrenOf = (path: string | undefined): FrontmatterNode[] => {
    if (!path) return root
    const existing = groups.get(path)
    if (existing) return existing.children

    const group: FrontmatterGroupNode = {
      kind: 'group',
      path,
      heading: titleFromPath(path),
      children: [],
    }
    groups.set(path, group)
    const parentEnd = path.lastIndexOf('.')
    childrenOf(parentEnd === -1 ? undefined : path.slice(0, parentEnd)).push(
      group
    )
    return group.children
  }

  const title = schema.fields.find(field => field.name === titleField)
  const ordered = title
    ? [title, ...schema.fields.filter(field => field !== title)]
    : schema.fields

  for (const field of ordered) {
    childrenOf(field.parentPath).push({
      kind: 'field',
      name: field.name,
      label: titleFromPath(field.name),
      field,
    })
  }

  // A key that's the parent of schema fields (`seo` for `seo.title`) is shown
  // through those fields
  const schemaNames = new Set(schema.fields.map(field => field.name))
  const extraKeys = frontmatterKeys
    .filter(
      key =>
        !schemaNames.has(key) &&
        !schema.fields.some(field => field.name.startsWith(`${key}.`))
    )
    .sort()

  return [...root, ...extraKeys.map(keyNode)]
}
