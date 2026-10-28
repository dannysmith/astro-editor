import type { MdxComponent, PropInfo } from '@/types'
import type { ClientDirective } from '../../store/componentBuilderStore'

/**
 * A value entered for a prop in the component builder. Strings hold text,
 * numbers, literal choices and ISO dates; booleans hold switch states; arrays
 * hold list items. A missing value means the prop is left out.
 */
export type PropValue = string | boolean | string[]

/** Whether a value counts as entered (empty strings and lists don't) */
function hasValue(value: PropValue | undefined): value is PropValue {
  if (value === undefined || value === '') return false
  return !Array.isArray(value) || value.length > 0
}

/**
 * Serialises a prop as an MDX attribute, e.g. `title="Hi"`, `count={2}`,
 * `open`, `when={new Date('2026-01-01')}`. Returns null when there's no value.
 */
export function serializeProp(
  prop: PropInfo,
  value: PropValue | undefined
): string | null {
  if (!hasValue(value)) return null
  const { name, kind } = prop

  if (typeof value === 'boolean') {
    return value ? name : `${name}={false}`
  }
  if (Array.isArray(value)) {
    const items = kind.kind === 'array' ? kind.items.kind : 'string'
    const list = value.map(item =>
      items === 'number' ? item.trim() : quoteString(item)
    )
    return `${name}={[${list.join(', ')}]}`
  }

  switch (kind.kind) {
    case 'number':
      return `${name}={${value.trim()}}`
    case 'date':
      return `${name}={new Date('${value}')}`
    default:
      return stringAttribute(name, value)
  }
}

/** `name="value"`, or a template literal when the value has quotes or newlines */
function stringAttribute(name: string, value: string): string {
  if (!/["\n]/.test(value)) return `${name}="${value}"`
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
  return `${name}={\`${escaped}\`}`
}

function quoteString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * How a required prop with no value is written: the text around a tab stop,
 * and what the tab stop starts with
 */
function emptyRequiredProp(prop: PropInfo): [string, string, string] {
  const { name, kind } = prop
  switch (kind.kind) {
    case 'number':
      return [`${name}={`, '', '}']
    case 'date':
      return [`${name}={new Date('`, '', `')}`]
    case 'array':
      return [`${name}={[`, '', ']}']
    case 'literals':
      return [`${name}="`, kind.values[0] ?? '', '"']
    default:
      return [`${name}="`, '', '"']
  }
}

/** Escapes text so CodeMirror's snippet parser doesn't read `${…}` in it as a field */
function escapeSnippetText(text: string): string {
  return text.replace(/[{}]/g, '\\$&')
}

/**
 * Builds the tag for a component from the values entered in the builder.
 * In snippet mode the result is a CodeMirror snippet template: required props
 * without a value, and the slot, become tab stops. Otherwise it's plain text,
 * for the preview.
 */
function buildTag(
  component: MdxComponent,
  values: Record<string, PropValue>,
  clientDirective: ClientDirective,
  snippet: boolean
): string {
  let fieldIndex = 1
  const text = snippet ? escapeSnippetText : (s: string) => s
  const field = (initial: string) =>
    snippet ? `\${${fieldIndex++}:${escapeSnippetText(initial)}}` : initial

  const attributes: string[] = []
  for (const prop of component.props) {
    const attribute = serializeProp(prop, values[prop.name])
    if (attribute !== null) {
      attributes.push(text(attribute))
    } else if (!prop.is_optional) {
      const [before, initial, after] = emptyRequiredProp(prop)
      attributes.push(text(before) + field(initial) + text(after))
    }
  }
  if (component.framework !== 'astro' && clientDirective !== 'none') {
    attributes.push(clientDirective)
  }

  const open = [component.name, ...attributes].join(' ')
  if (!component.has_slot) {
    return snippet ? `<${open} />\${}` : `<${open} />`
  }
  return snippet
    ? `<${open}>${field('')}</${component.name}>\${}`
    : `<${open}></${component.name}>`
}

/** A CodeMirror snippet template for inserting the component */
export function buildSnippet(
  component: MdxComponent,
  values: Record<string, PropValue>,
  clientDirective: ClientDirective = 'none'
): string {
  return buildTag(component, values, clientDirective, true)
}

/** The tag as it will be inserted, for previewing in the builder */
export function buildPreview(
  component: MdxComponent,
  values: Record<string, PropValue>,
  clientDirective: ClientDirective = 'none'
): string {
  return buildTag(component, values, clientDirective, false)
}
