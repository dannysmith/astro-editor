import { FieldType, type SchemaField, type FieldConstraints } from './schema'
import { camelCaseToTitleCase } from './utils'

interface JsonSchemaProperty {
  type?: string | string[]
  format?: string
  anyOf?: JsonSchemaProperty[]
  enum?: string[]
  const?: string
  items?: JsonSchemaProperty | JsonSchemaProperty[]
  properties?: Record<string, JsonSchemaProperty>
  additionalProperties?: boolean | JsonSchemaProperty
  required?: string[]
  description?: string
  markdownDescription?: string
  default?: unknown
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  pattern?: string
}

interface JsonSchemaDefinition {
  type: string
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
  additionalProperties?: boolean | JsonSchemaProperty
}

interface AstroJsonSchema {
  $ref: string
  definitions: Record<string, JsonSchemaDefinition>
  $schema: string
}

/**
 * Parse Astro-generated JSON schema and extract field definitions
 */
export function parseJsonSchema(
  schemaJson: string
): { fields: SchemaField[] } | null {
  try {
    const schema = JSON.parse(schemaJson) as AstroJsonSchema

    // Extract the collection name from $ref
    const collectionName = schema.$ref.replace('#/definitions/', '')
    const collectionDef = schema.definitions[collectionName]

    if (!collectionDef) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(`Collection definition not found for: ${collectionName}`)
      }
      return null
    }

    // Check if this is a file-based collection (has additionalProperties with schema)
    if (
      collectionDef.additionalProperties &&
      typeof collectionDef.additionalProperties === 'object'
    ) {
      // File-based collection - use the additionalProperties as the entry schema
      const entrySchema = collectionDef.additionalProperties
      return parseEntrySchema(entrySchema as JsonSchemaDefinition)
    }

    // Standard collection - parse properties directly
    return parseEntrySchema(collectionDef)
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse JSON schema:', error)
    }
    return null
  }
}

/**
 * Parse an entry schema definition
 */
function parseEntrySchema(entrySchema: JsonSchemaDefinition): {
  fields: SchemaField[]
} | null {
  if (!entrySchema.properties) {
    return null
  }

  const requiredFields = new Set(entrySchema.required || [])
  const fields: SchemaField[] = []

  for (const [fieldName, fieldSchema] of Object.entries(
    entrySchema.properties
  )) {
    // Skip $schema metadata field
    if (fieldName === '$schema') continue

    const parsedFields = parseField(
      fieldName,
      fieldSchema,
      requiredFields.has(fieldName)
    )
    fields.push(...parsedFields)
  }

  return { fields }
}

/**
 * Parse a single field (may return multiple fields for nested objects)
 */
function parseField(
  fieldName: string,
  fieldSchema: JsonSchemaProperty,
  isRequired: boolean,
  parentPath = ''
): SchemaField[] {
  const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName
  const label = camelCaseToTitleCase(fieldName)

  // Determine field type
  const fieldType = determineFieldType(fieldSchema)

  // Handle nested objects - flatten with dot notation
  if (
    fieldType.type === FieldType.Unknown &&
    fieldSchema.type === 'object' &&
    fieldSchema.properties
  ) {
    const nestedFields: SchemaField[] = []
    const nestedRequired = new Set(fieldSchema.required || [])

    for (const [nestedName, nestedSchema] of Object.entries(
      fieldSchema.properties
    )) {
      const nestedParsed = parseField(
        nestedName,
        nestedSchema,
        nestedRequired.has(nestedName),
        fullPath
      )
      nestedFields.push(...nestedParsed)
    }

    return nestedFields
  }

  // Extract constraints
  const constraints = extractConstraints(fieldSchema, fieldType.type)

  // Extract description
  const description = fieldSchema.description || fieldSchema.markdownDescription

  // Extract default value
  const defaultValue = fieldSchema.default

  const field: SchemaField = {
    name: fullPath,
    label: parentPath
      ? `${camelCaseToTitleCase(parentPath.split('.').pop()!)} ${label}`
      : label,
    type: fieldType.type,
    required: isRequired && !('default' in fieldSchema),
    ...(fieldType.subType && { subType: fieldType.subType }),
    ...(constraints && { constraints }),
    ...(description && { description }),
    ...(defaultValue !== undefined && { default: defaultValue }),
    ...(fieldType.enumValues && { enumValues: fieldType.enumValues }),
    ...(fieldType.reference && { reference: fieldType.reference }),
    ...(fieldType.subReference && { subReference: fieldType.subReference }),
    ...(fieldType.referenceCollection && {
      referenceCollection: fieldType.referenceCollection,
    }),
    // Nested object metadata
    ...(parentPath && {
      isNested: true,
      parentPath: parentPath,
    }),
  }

  return [field]
}

/**
 * Determine the field type from JSON schema property
 */
function determineFieldType(fieldSchema: JsonSchemaProperty): {
  type: FieldType
  subType?: FieldType
  enumValues?: string[]
  referenceCollection?: string
  reference?: string
  subReference?: string
} {
  // Handle anyOf (dates, references, unions)
  if (fieldSchema.anyOf) {
    if (isDateField(fieldSchema.anyOf)) {
      return { type: FieldType.Date }
    }
    const refInfo = extractReferenceInfo(fieldSchema.anyOf)
    if (refInfo.isReference) {
      return {
        type: FieldType.Reference,
        reference: refInfo.collectionName,
        // Keep referenceCollection for backwards compatibility
        referenceCollection: refInfo.collectionName,
      }
    }
    // Other unions - treat as string for V1
    return { type: FieldType.String }
  }

  // Handle enum
  if (fieldSchema.enum) {
    return {
      type: FieldType.Enum,
      enumValues: fieldSchema.enum,
    }
  }

  // Handle const (literal) - treat as string with default
  if (fieldSchema.const !== undefined) {
    return { type: FieldType.String }
  }

  // Handle arrays
  if (fieldSchema.type === 'array') {
    const itemsSchema = fieldSchema.items
    if (Array.isArray(itemsSchema)) {
      // Tuple - treat as JSON string for V1
      return { type: FieldType.String }
    }
    if (itemsSchema) {
      const itemType = determineFieldType(itemsSchema)

      // If array items are references, capture the collection name in subReference
      if (itemType.type === FieldType.Reference && itemType.reference) {
        return {
          type: FieldType.Array,
          subType: itemType.type,
          subReference: itemType.reference,
        }
      }

      return { type: FieldType.Array, subType: itemType.type }
    }
    return { type: FieldType.Array, subType: FieldType.String }
  }

  // Handle objects
  if (fieldSchema.type === 'object') {
    // Records (with additionalProperties)
    if (fieldSchema.additionalProperties) {
      // Treat as JSON string for V1
      return { type: FieldType.String }
    }
    // Nested objects will be flattened by parseField
    return { type: FieldType.Unknown }
  }

  // Handle primitives
  if (fieldSchema.type === 'string') {
    if (fieldSchema.format === 'email') return { type: FieldType.Email }
    if (fieldSchema.format === 'uri') return { type: FieldType.URL }
    return { type: FieldType.String }
  }

  if (fieldSchema.type === 'integer') {
    return { type: FieldType.Integer }
  }

  if (fieldSchema.type === 'number') {
    return { type: FieldType.Number }
  }

  if (fieldSchema.type === 'boolean') {
    return { type: FieldType.Boolean }
  }

  return { type: FieldType.Unknown }
}

/**
 * Check if anyOf represents a date field
 */
function isDateField(anyOfArray: JsonSchemaProperty[]): boolean {
  return anyOfArray.some(
    s =>
      s.format === 'date-time' ||
      s.format === 'date' ||
      s.format === 'unix-time'
  )
}

/**
 * Check if anyOf represents a reference field and extract collection name
 */
function extractReferenceInfo(anyOfArray: JsonSchemaProperty[]): {
  isReference: boolean
  collectionName?: string
} {
  for (const s of anyOfArray) {
    const props = s.properties
    if (
      s.type === 'object' &&
      props?.collection !== undefined &&
      (props?.id !== undefined || props?.slug !== undefined)
    ) {
      // Extract collection name from const
      const collectionName =
        typeof props.collection === 'object' && 'const' in props.collection
          ? (props.collection.const as string)
          : undefined

      return { isReference: true, collectionName }
    }
  }
  return { isReference: false }
}

/**
 * Extract constraints from field schema
 */
function extractConstraints(
  fieldSchema: JsonSchemaProperty,
  fieldType: FieldType
): FieldConstraints | undefined {
  const constraints: FieldConstraints = {}

  // Numeric constraints
  if (fieldSchema.minimum !== undefined) {
    constraints.min = fieldSchema.minimum
  }
  if (fieldSchema.maximum !== undefined) {
    constraints.max = fieldSchema.maximum
  }
  if (fieldSchema.exclusiveMinimum !== undefined) {
    constraints.min = fieldSchema.exclusiveMinimum + 1
  }
  if (fieldSchema.exclusiveMaximum !== undefined) {
    constraints.max = fieldSchema.exclusiveMaximum - 1
  }

  // String constraints
  if (fieldSchema.minLength !== undefined) {
    constraints.minLength = fieldSchema.minLength
  }
  if (fieldSchema.maxLength !== undefined) {
    constraints.maxLength = fieldSchema.maxLength
  }
  if (fieldSchema.pattern) {
    constraints.pattern = fieldSchema.pattern
  }

  // Format constraints
  if (fieldSchema.format) {
    if (
      fieldSchema.format === 'email' ||
      fieldSchema.format === 'uri' ||
      fieldSchema.format === 'date-time' ||
      fieldSchema.format === 'date'
    ) {
      constraints.format = fieldSchema.format
    }
  }

  // Array constraints
  if (fieldType === FieldType.Array) {
    if (fieldSchema.minItems !== undefined) {
      constraints.minLength = fieldSchema.minItems
    }
    if (fieldSchema.maxItems !== undefined) {
      constraints.maxLength = fieldSchema.maxItems
    }
  }

  return Object.keys(constraints).length > 0 ? constraints : undefined
}
