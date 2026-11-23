import { getNestedValue } from '../lib/object-utils'
import { shownFrontmatter, useEditorStore } from '../store/editorStore'

/**
 * A frontmatter field's value as the panel shows it, and a setter that writes
 * it to the store. `name` may be a dot path. Each field subscribes to its own
 * value, so typing in one doesn't re-render the others.
 */
export function useFrontmatterValue(name: string) {
  const value = useEditorStore(state =>
    getNestedValue(shownFrontmatter(state), name)
  )
  const setValue = (newValue: unknown) => {
    useEditorStore.getState().updateFrontmatterField(name, newValue)
  }
  return [value, setValue] as const
}
