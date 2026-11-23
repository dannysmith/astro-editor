import { getNestedValue } from '../lib/object-utils'
import { shownFrontmatter, useEditorStore } from '../store/editorStore'

/** A frontmatter field's value (`name` may be a dot path), as the panel shows it */
export function useFrontmatterValue(name: string) {
  return useEditorStore(state => getNestedValue(shownFrontmatter(state), name))
}
