/**
 * Parse Zod schema string to extract reference field mappings
 *
 * This module provides utilities to extract reference field information from
 * Zod schema strings. This is necessary because Astro's generated JSON schemas
 * don't preserve collection names from reference() calls.
 *
 * Handles:
 * - Single references: author: reference('authors')
 * - Array references: relatedPosts: z.array(reference('posts'))
 *
 * Limitations:
 * - Nested references (seo.author: reference('authors')) are not supported
 *   due to the complexity of tracking nesting context with regex
 */

export interface ReferenceMapping {
  fieldPath: string // e.g., 'author' or 'relatedArticles'
  collectionName: string // e.g., 'authors' or 'articles'
  isArray: boolean // true for array references
}

/**
 * Parse a Zod schema string to extract reference field mappings
 *
 * @param zodSchema - The Zod schema string from content.config.ts
 * @returns Array of reference mappings found in the schema
 *
 * @example
 * const zodSchema = `
 *   author: reference('authors').optional(),
 *   relatedArticles: z.array(reference('articles')).max(3)
 * `
 * const refs = parseZodSchemaReferences(zodSchema)
 * // Returns:
 * // [
 * //   { fieldPath: 'author', collectionName: 'authors', isArray: false },
 * //   { fieldPath: 'relatedArticles', collectionName: 'articles', isArray: true }
 * // ]
 */
export function parseZodSchemaReferences(
  zodSchema: string
): ReferenceMapping[] {
  const references: ReferenceMapping[] = []

  // Pattern 1: Array reference - posts: z.array(reference('posts'))
  // Must match this BEFORE single reference to avoid false positives
  const arrayRefRegex = /(\w+):\s*z\.array\(reference\(['"]([^'"]+)['"]\)\)/g

  // Pattern 2: Simple reference - author: reference('authors')
  const singleRefRegex = /(\w+):\s*reference\(['"]([^'"]+)['"]\)/g

  let match

  // Extract array references first (more specific pattern)
  while ((match = arrayRefRegex.exec(zodSchema)) !== null) {
    references.push({
      fieldPath: match[1]!,
      collectionName: match[2]!,
      isArray: true,
    })
  }

  // Extract single references (skip if already found as array)
  const arrayFields = new Set(references.map(r => r.fieldPath))
  while ((match = singleRefRegex.exec(zodSchema)) !== null) {
    const fieldPath = match[1]!
    if (!arrayFields.has(fieldPath)) {
      references.push({
        fieldPath,
        collectionName: match[2]!,
        isArray: false,
      })
    }
  }

  return references
}
