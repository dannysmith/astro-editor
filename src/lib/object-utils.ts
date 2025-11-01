/**
 * Utilities for safely manipulating nested object values
 * Includes prototype pollution protection
 */

/**
 * Set a nested value in an object using dot notation
 * Example: setNestedValue(obj, 'author.name', 'John') → { author: { name: 'John' } }
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.')
  if (keys.length === 1) {
    // Protect against prototype pollution on simple keys
    if (
      path === '__proto__' ||
      path === 'constructor' ||
      path === 'prototype'
    ) {
      throw new Error(
        `Unsafe key "${path}" in path "${path}", prototype pollution prevented.`
      )
    }
    // Simple key, no nesting
    return { ...obj, [path]: value }
  }

  // Create nested structure
  const result = { ...obj }
  let current: Record<string, unknown> = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    // Protect against prototype pollution in nested paths
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(
        `Unsafe key "${key}" in path "${path}", prototype pollution prevented.`
      )
    }
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    } else {
      // Clone existing nested object
      current[key] = { ...(current[key] as Record<string, unknown>) }
    }
    current = current[key] as Record<string, unknown>
  }

  // Set the final value
  const lastKey = keys[keys.length - 1]!
  // Protect against prototype pollution on final key
  if (
    lastKey === '__proto__' ||
    lastKey === 'constructor' ||
    lastKey === 'prototype'
  ) {
    throw new Error(
      `Unsafe key "${lastKey}" in path "${path}", prototype pollution prevented.`
    )
  }
  current[lastKey] = value

  return result
}

/**
 * Get a nested value from an object using dot notation
 * Example: getNestedValue(obj, 'author.name') → 'John'
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

/**
 * Delete a nested value in an object using dot notation
 * Also cleans up empty parent objects
 */
export function deleteNestedValue(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  const keys = path.split('.')
  if (keys.length === 1) {
    // Protect against prototype pollution on simple keys
    if (
      path === '__proto__' ||
      path === 'constructor' ||
      path === 'prototype'
    ) {
      throw new Error(
        `Unsafe key "${path}" in path "${path}", prototype pollution prevented.`
      )
    }
    // Simple key
    const result = { ...obj }
    delete result[path]
    return result
  }

  // Navigate to parent and delete
  const result = { ...obj }
  let current: Record<string, unknown> = result
  const parents: Array<{ obj: Record<string, unknown>; key: string }> = []

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    // Protect against prototype pollution in nested paths
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(
        `Unsafe key "${key}" in path "${path}", prototype pollution prevented.`
      )
    }
    if (typeof current[key] !== 'object' || current[key] === null) {
      // Path doesn't exist, nothing to delete
      return result
    }
    // Clone nested object
    current[key] = { ...(current[key] as Record<string, unknown>) }
    parents.push({ obj: current, key })
    current = current[key] as Record<string, unknown>
  }

  // Delete the final key
  const lastKey = keys[keys.length - 1]!
  // Protect against prototype pollution on final key
  if (
    lastKey === '__proto__' ||
    lastKey === 'constructor' ||
    lastKey === 'prototype'
  ) {
    throw new Error(
      `Unsafe key "${lastKey}" in path "${path}", prototype pollution prevented.`
    )
  }
  delete current[lastKey]

  // Clean up empty parent objects (bottom-up)
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i]!
    const { obj, key } = parent
    const nested = obj[key] as Record<string, unknown>
    if (Object.keys(nested).length === 0) {
      delete obj[key]
    } else {
      break // Stop cleaning if parent is not empty
    }
  }

  return result
}
