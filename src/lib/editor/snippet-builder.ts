import { MdxComponent } from '../../hooks/queries/useMdxComponentsQuery'
import { ClientDirective } from '../../store/componentBuilderStore'

/**
 * Builds an MDX component snippet string for insertion using CodeMirror's snippet system
 * @param component The MDX component to build
 * @param enabledProps Set of prop names that should be included
 * @param clientDirective Client directive for framework components (optional, defaults to 'none')
 * @returns A snippet string with placeholders for tab navigation
 */
export function buildSnippet(
  component: MdxComponent,
  enabledProps: Set<string>,
  clientDirective: ClientDirective = 'none'
): string {
  let placeholderIndex = 1

  const propsString = component.props
    .filter(p => enabledProps.has(p.name))
    .map(p => {
      // For props with specific values (like 'warning' | 'info'), use the first value as default
      let defaultValue = ''
      if (p.prop_type.includes('|')) {
        // Extract first literal value from union type
        const firstLiteral = p.prop_type.split('|')[0]?.trim()
        if (firstLiteral?.startsWith("'") && firstLiteral?.endsWith("'")) {
          defaultValue = firstLiteral.slice(1, -1)
        }
      }

      // Make sure defaultValue is always a string
      return `${p.name}="\${${placeholderIndex++}:${defaultValue || ''}}"`
    })
    .join(' ')

  // Add client directive for framework components (not Astro)
  const directiveString =
    component.framework !== 'astro' && clientDirective !== 'none'
      ? clientDirective
      : ''

  // Combine props and directive
  const allAttrs = [propsString, directiveString].filter(Boolean).join(' ')

  if (component.has_slot) {
    const attrsPrefix = allAttrs ? ' ' + allAttrs : ''
    return `<${component.name}${attrsPrefix}>\${${placeholderIndex}}</${component.name}>\${}`
  }

  const attrsPrefix = allAttrs ? ' ' + allAttrs : ''
  return `<${component.name}${attrsPrefix} />\${}`
}
