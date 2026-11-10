/**
 * How the project settings dialog words and offers what AE has read: where
 * collections come from, schema fields, sort orders and frontmatter keys.
 * Text in backticks is shown as code.
 */

import type {
  Collection,
  DefaultSort,
  FileEntry,
  ProjectScan,
} from '@/lib/bindings'
import { FieldType, type SchemaField } from '../schema'
import type { SortOption } from '../files/sorting'
import { isUnreadLoader } from './status'

/**
 * Where a collection comes from, as a sentence for the top of its page, like
 * "From `glob()` in `src/content.config.ts`."
 */
export function describeOrigin(
  collection: Collection,
  scan: ProjectScan
): string {
  const config = scan.configPath ? ` in \`${scan.configPath}\`` : ''
  const loader = `\`${collection.loaderName}()\``
  // No loader name: the definition couldn't be followed, often because it's
  // imported from another file, so whether it reads files is unknown
  const unreadDefinition = `Its definition${config} couldn't be read, perhaps because it's in another file`

  if (isUnreadLoader(collection)) {
    return collection.loaderName
      ? `From ${loader}${config}, which probably doesn't read files.`
      : `${unreadDefinition}.`
  }
  switch (collection.kind) {
    case 'glob':
      return `From \`glob()\`${config}.`
    case 'legacy':
      return `A legacy collection${config}, without a loader.`
    case 'unknown':
      return collection.loaderName
        ? `From ${loader}${config}. Its folder is assumed to be the one named after it.`
        : `${unreadDefinition}, so its folder is assumed to be the one named after it.`
    case 'folder':
      return `A folder in \`${scan.projectSettings.contentDirectory.value}\`.`
    case 'data':
      return `JSON or YAML data${config ? ` from \`${scan.configPath}\`` : ''}. Data collections aren't edited here.`
  }
}

/**
 * The path a file at the top of `folder` would write for `photo.jpg` added to
 * `collection`, with images in `assets`: from the project root, or relative to
 * the file. Folders are relative to the project.
 */
export function exampleImagePath(
  folder: string,
  assets: string,
  collection: string,
  absolute: boolean
): string {
  const image = `${assets}/${collection}/photo.jpg`
  if (absolute) return `/${image}`
  const from = folder.split('/').filter(part => part && part !== '.')
  const to = image.split('/')
  let common = 0
  while (
    common < from.length &&
    common < to.length - 1 &&
    from[common] === to[common]
  ) {
    common++
  }
  return [...from.slice(common).map(() => '..'), ...to.slice(common)].join('/')
}

/** A field's type, like `array of string` or `reference to authors` */
export function describeFieldType(field: SchemaField): string {
  if (field.type === FieldType.Reference) {
    return field.reference ? `reference to ${field.reference}` : 'reference'
  }
  if (field.type === FieldType.Array) {
    if (field.subReference)
      return `array of references to ${field.subReference}`
    return field.subType ? `array of ${field.subType}` : 'array'
  }
  if (field.type === FieldType.Enum && field.enumValues) {
    return `one of ${field.enumValues.map(value => `\`${value}\``).join(', ')}`
  }
  return field.type
}

function range(
  min: number | undefined,
  max: number | undefined,
  unit: string
): string | null {
  if (min !== undefined && max !== undefined) {
    return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`
  }
  if (min !== undefined) return `at least ${min} ${unit}`
  if (max !== undefined) return `at most ${max} ${unit}`
  return null
}

/** A field's constraints and default, as short phrases */
export function describeConstraints(field: SchemaField): string[] {
  const c = field.constraints ?? {}
  const parts: (string | null)[] = []

  if (
    c.min !== undefined &&
    c.max !== undefined &&
    !c.minExclusive &&
    !c.maxExclusive
  ) {
    parts.push(`${c.min}–${c.max}`)
  } else {
    if (c.min !== undefined) {
      parts.push(`${c.minExclusive ? '>' : '≥'} ${c.min}`)
    }
    if (c.max !== undefined) {
      parts.push(`${c.maxExclusive ? '<' : '≤'} ${c.max}`)
    }
  }
  parts.push(range(c.minLength, c.maxLength, 'characters'))
  parts.push(range(c.minItems, c.maxItems, 'items'))
  if (c.pattern) parts.push(`matches \`${c.pattern}\``)
  if (c.format && field.type === FieldType.String) {
    parts.push(`${c.format} format`)
  }
  if (field.default !== undefined) {
    parts.push(`defaults to \`${JSON.stringify(field.default)}\``)
  }
  return parts.filter((part): part is string => part !== null)
}

/** The directions a sort mode can go in, worded for its kind */
function directions(option: SortOption): [string, string] {
  switch (option.type) {
    case 'date':
      return ['oldest first', 'newest first']
    case 'numeric':
      return ['lowest first', 'highest first']
    default:
      return ['A to Z', 'Z to A']
  }
}

/** The default sort setting's choices: each sort mode, each way round */
export function defaultSortChoices(
  options: SortOption[]
): { value: string; label: string; sort: DefaultSort }[] {
  return options
    .filter(option => option.id !== 'default')
    .flatMap(option => {
      const [asc, desc] = directions(option)
      return [
        {
          value: `${option.id}:asc`,
          label: `${option.label}, ${asc}`,
          sort: { mode: option.id, direction: 'asc' as const },
        },
        {
          value: `${option.id}:desc`,
          label: `${option.label}, ${desc}`,
          sort: { mode: option.id, direction: 'desc' as const },
        },
      ]
    })
}

const DATE = /^\d{4}-\d{2}-\d{2}/

/**
 * The frontmatter keys a collection's files have with values of a type, most
 * common first. Field mappings offer these when there's no generated schema to
 * offer fields from.
 */
export function frontmatterKeysOfType(
  files: FileEntry[],
  type: FieldType.String | FieldType.Date | FieldType.Boolean
): string[] {
  const counts = new Map<string, number>()
  for (const file of files) {
    for (const [key, value] of Object.entries(file.frontmatter ?? {})) {
      const matches =
        type === FieldType.Boolean
          ? typeof value === 'boolean'
          : typeof value === 'string' &&
            DATE.test(value) === (type === FieldType.Date)
      if (matches) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([key]) => key)
}
