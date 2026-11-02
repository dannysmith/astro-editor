import type { EntryImport, ImageImport, MdxComponent, PropInfo } from '@/types'
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
    // Imported bindings: the writer enters the variable's name
    case 'image':
    case 'collectionEntry':
      return `${name}={${value.trim()}}`
    case 'date':
      return `${name}={new Date('${value}')}`
    default:
      return stringAttribute(name, value)
  }
}

/**
 * `name="value"`, or a template literal when the value has quotes, line breaks
 * or a character reference (`&amp;`), which a quoted attribute would decode.
 * Line breaks and tabs are escaped so the attribute stays on one line, since
 * the editor re-indents the lines of an inserted snippet.
 */
function stringAttribute(name: string, value: string): string {
  if (!/["\n\t]|&#?\w+;/.test(value)) return `${name}="${value}"`
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
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
    case 'image':
    case 'collectionEntry':
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

/**
 * Escapes text so CodeMirror's snippet parser leaves it as written. Only two
 * braces need it: one opening `${…}` or `#{…}`, which would start a field, and
 * one after a backslash, which the parser would take as an escape and drop the
 * backslash. Other braces (`count={3}`) pass through, which matters because the
 * parser misplaces tab stops that follow runs of escapes.
 */
function escapeSnippetText(text: string): string {
  return text.replace(/(?<=[$#\\])[{}]/g, '\\$&')
}

/**
 * Whether the component goes in as a block, with its content on lines of its
 * own: always for components with a slot template (Tabs, Steps), and for any
 * component with a slot when it's inserted on an empty line. Otherwise it goes
 * in inline, at the cursor.
 */
export function insertsAsBlock(
  component: MdxComponent,
  onEmptyLine: boolean
): boolean {
  return component.slot_template !== null || (component.has_slot && onEmptyLine)
}

/**
 * Builds the tag for a component from the values entered in the builder.
 * In snippet mode the result is a CodeMirror snippet template: required props
 * without a value, and the slot (or the tab stops in the component's slot
 * template), become tab stops. Otherwise it's plain text for the preview, with
 * `…` marking an empty slot.
 */
function buildTag(
  component: MdxComponent,
  values: Record<string, PropValue>,
  clientDirective: ClientDirective,
  block: boolean,
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
  // `client:only` names the framework to render with; `client:media` needs a query
  if (component.framework !== 'astro' && clientDirective !== 'none') {
    if (clientDirective === 'client:only') {
      attributes.push(`client:only="${component.framework}"`)
    } else if (clientDirective === 'client:media') {
      attributes.push(`client:media="${field('(max-width: 50em)')}"`)
    } else {
      attributes.push(clientDirective)
    }
  }

  const open = [component.name, ...attributes].join(' ')
  if (!component.has_slot) {
    return snippet ? `<${open} />\${}` : `<${open} />`
  }
  const template = component.slot_template
  const content = snippet ? field('') : '…'
  const slot = template
    ? snippet
      ? template
      : snippetText(template)
    : block
      ? `\n${content}\n`
      : content
  return snippet
    ? `<${open}>${slot}</${component.name}>\${}`
    : `<${open}>${slot}</${component.name}>`
}

/** A snippet template as plain text: `${name}` becomes `name`, `${}` nothing */
function snippetText(template: string): string {
  return template
    .replace(/[$#]\{(?:\d+:)?([^{}]*)\}/g, '$1')
    .replace(/\\([{}])/g, '$1')
}

/** A CodeMirror snippet template for inserting the component */
export function buildSnippet(
  component: MdxComponent,
  values: Record<string, PropValue>,
  clientDirective: ClientDirective = 'none',
  block = false
): string {
  return buildTag(component, values, clientDirective, block, true)
}

/** The tag as it will be inserted, for previewing in the builder */
export function buildPreview(
  component: MdxComponent,
  values: Record<string, PropValue>,
  clientDirective: ClientDirective = 'none',
  block = false
): string {
  return buildTag(component, values, clientDirective, block, false)
}

/** The image or entry picked for each prop that has one, by prop name */
export interface Picks {
  images: Record<string, ImageImport>
  entries: Record<string, EntryImport>
}

/**
 * The component and values to build the tag from, with each picked image or
 * entry as the name it's imported or loaded as (`cover={heroImage}`). A pick
 * without a name, because imports are switched off or couldn't be planned,
 * goes in as its path (`cover="../../assets/a.png"`) or id
 * (`review="first-post"`), which is easier to sort out in a code editor than
 * a name nothing imports.
 */
export function withPicks(
  component: MdxComponent,
  values: Record<string, PropValue>,
  picks: Picks,
  names: Partial<Record<string, string>> = {}
): { component: MdxComponent; values: Record<string, PropValue> } {
  const picked: [string, string][] = [
    ...Object.entries(picks.images).map(
      ([prop, image]) => [prop, image.specifier] as [string, string]
    ),
    ...Object.entries(picks.entries).map(
      ([prop, entry]) => [prop, entry.id] as [string, string]
    ),
  ]
  const asText = new Set<string>()
  const pickedValues: Record<string, string> = {}
  for (const [prop, text] of picked) {
    const name = names[prop]
    if (name) {
      pickedValues[prop] = name
    } else {
      pickedValues[prop] = text
      asText.add(prop)
    }
  }
  return {
    component:
      asText.size === 0
        ? component
        : {
            ...component,
            props: component.props.map(prop =>
              asText.has(prop.name)
                ? { ...prop, kind: { kind: 'string' } }
                : prop
            ),
          },
    values: { ...values, ...pickedValues },
  }
}
