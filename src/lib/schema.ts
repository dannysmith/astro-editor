// Legacy Zod-based interfaces (for fallback)
export interface ZodField {
  name: string
  type: ZodFieldType
  optional: boolean
  default?: string
  options?: string[] // For enum fields
  constraints?: ZodFieldConstraints
  arrayType?: ZodFieldType // For array fields
  unionTypes?: Array<ZodFieldType | { type: 'Literal'; value: string }> // For union fields
  literalValue?: string // For literal fields
}

export interface ZodFieldConstraints {
  // Numeric constraints
  min?: number
  max?: number
  length?: number
  minLength?: number
  maxLength?: number

  // String validation
  regex?: string
  includes?: string
  startsWith?: string
  endsWith?: string
  url?: boolean
  email?: boolean
  uuid?: boolean
  cuid?: boolean
  cuid2?: boolean
  ulid?: boolean
  emoji?: boolean
  ip?: boolean

  // String transformations
  trim?: boolean
  toLowerCase?: boolean
  toUpperCase?: boolean

  // Meta information
  transform?: string
  refine?: string
  literal?: string
}

export type ZodFieldType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'Array'
  | 'Enum'
  | 'Union'
  | 'Literal'
  | 'Object'
  | 'Unknown'

// New JSON Schema-based interfaces
export interface SchemaField {
  // Identity
  name: string // Field name (or flattened: "seo.title")
  label: string // Human-readable label

  // Type
  type: FieldType
  subType?: FieldType // For arrays

  // Validation
  required: boolean
  constraints?: FieldConstraints

  // UI Metadata
  description?: string // From .describe()
  default?: unknown // Default value from schema

  // Type-specific
  enumValues?: string[] // For enum fields
  referenceCollection?: string // For reference fields (future)
}

export interface FieldConstraints {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'email' | 'uri' | 'date-time' | 'date'
}

export enum FieldType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Date = 'date',
  Email = 'email',
  URL = 'url',
  Array = 'array',
  Enum = 'enum',
  Reference = 'reference',
  Unknown = 'unknown',
}

export interface ParsedSchema {
  type: 'zod'
  fields: ZodField[]
}

interface ParsedSchemaJson {
  type: 'zod'
  fields: Array<{
    name: string
    type: string
    optional: boolean
    default?: string
    options?: string[] // For enum fields
    constraints?: Record<string, unknown> // For constraint information
    arrayType?: string // For array fields
    unionTypes?: Array<string | { type: 'Literal'; value: string }> // For union fields
    literalValue?: string // For literal fields
  }>
}

/**
 * Parse the schema JSON string from the backend into typed schema information
 */
export function parseSchemaJson(schemaJson: string): ParsedSchema | null {
  try {
    const parsed: unknown = JSON.parse(schemaJson)

    // Type guard to check if parsed object has expected structure
    if (!isValidParsedSchema(parsed)) {
      return null
    }

    const fields: ZodField[] = parsed.fields.map(field => ({
      name: field.name,
      type: field.type as ZodFieldType,
      optional: field.optional || false,
      ...(field.default !== undefined && { default: field.default }),
      ...(field.options !== undefined && { options: field.options }),
      ...(field.constraints !== undefined && {
        constraints: field.constraints as ZodFieldConstraints,
      }),
      ...(field.arrayType !== undefined && {
        arrayType: field.arrayType as ZodFieldType,
      }),
      ...(field.unionTypes !== undefined && {
        unionTypes: field.unionTypes.map(t =>
          typeof t === 'string' ? (t as ZodFieldType) : t
        ),
      }),
      ...(field.literalValue !== undefined && {
        literalValue: field.literalValue,
      }),
    }))

    return {
      type: 'zod',
      fields,
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse schema JSON:', error)
    }
    return null
  }
}

function isValidParsedSchema(obj: unknown): obj is ParsedSchemaJson {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    obj.type === 'zod' &&
    'fields' in obj &&
    Array.isArray(obj.fields) &&
    obj.fields.every(
      (field: unknown) =>
        typeof field === 'object' &&
        field !== null &&
        'name' in field &&
        typeof field.name === 'string' &&
        'type' in field &&
        typeof field.type === 'string' &&
        'optional' in field &&
        typeof field.optional === 'boolean'
    )
  )
}

/**
 * Get the appropriate input type for a form field based on Zod type
 */
export function getInputTypeForZodField(fieldType: ZodFieldType): string {
  switch (fieldType) {
    case 'String':
      return 'text'
    case 'Number':
      return 'number'
    case 'Boolean':
      return 'checkbox'
    case 'Date':
      return 'date'
    case 'Array':
      return 'text' // Will handle as comma-separated values
    case 'Enum':
      return 'select'
    case 'Union':
      return 'text' // Handle unions as text input for now
    case 'Literal':
      return 'text' // Literals can be displayed as readonly text
    case 'Object':
      return 'text' // Objects as JSON text for now
    default:
      return 'text'
  }
}

/**
 * Create a default value for a field based on its type and schema
 */
export function getDefaultValueForField(
  field: ZodField
): string | number | boolean | string[] {
  if (field.default !== undefined) {
    return field.default
  }

  switch (field.type) {
    case 'String':
      return ''
    case 'Number':
      return 0
    case 'Boolean':
      return false
    case 'Date':
      return new Date().toISOString().split('T')[0] || '' // YYYY-MM-DD format
    case 'Array':
      return []
    case 'Literal':
      return field.literalValue || ''
    case 'Union':
      // For unions, return the default for the first non-literal type
      if (field.unionTypes && field.unionTypes.length > 0) {
        const firstType = field.unionTypes[0]
        if (typeof firstType === 'string') {
          return getDefaultValueForField({ ...field, type: firstType })
        }
      }
      return ''
    default:
      return ''
  }
}

/**
 * Validate a field value against its schema
 */
export function validateFieldValue(
  field: ZodField,
  value: unknown
): string | null {
  // If field is optional and value is empty, it's valid
  if (
    field.optional &&
    (value === '' || value === null || value === undefined)
  ) {
    return null
  }

  // Required field validation
  if (
    !field.optional &&
    (value === '' || value === null || value === undefined)
  ) {
    return `${field.name} is required`
  }

  // Type-specific validation
  switch (field.type) {
    case 'Number':
      if (isNaN(Number(value))) {
        return `${field.name} must be a number`
      }
      break
    case 'Boolean':
      if (typeof value !== 'boolean') {
        return `${field.name} must be a boolean`
      }
      break
    case 'Date':
      if (value && typeof value === 'string' && isNaN(Date.parse(value))) {
        return `${field.name} must be a valid date`
      }
      break
  }

  return null
}
