import { camelCaseToTitleCase } from './utils'

// Legacy Zod-based interfaces (for fallback parsing only)
// These are internal types used during Zod schema parsing
interface ZodField {
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

interface ZodFieldConstraints {
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

type ZodFieldType =
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

  // References
  reference?: string // Referenced collection name (for single reference)
  subReference?: string // Referenced collection name (for array of references)
  referenceCollection?: string // Legacy - kept for backwards compatibility

  // Nested Objects
  nestedFields?: SchemaField[] // Child fields for object types
  isNested?: boolean // Is this field nested under a parent?
  parentPath?: string // Parent path, e.g. "author" for "author.name"
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
  Object = 'object', // For nested objects (rendered as grouped fields)
  Unknown = 'unknown',
}

// Internal type for parsing Zod schema JSON
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
 * Convert ZodFieldType to FieldType
 */
function zodFieldTypeToFieldType(zodType: ZodFieldType): FieldType {
  const typeMap: Record<ZodFieldType, FieldType> = {
    String: FieldType.String,
    Number: FieldType.Number,
    Boolean: FieldType.Boolean,
    Date: FieldType.Date,
    Array: FieldType.Array,
    Enum: FieldType.Enum,
    Union: FieldType.String, // Fallback for V1
    Literal: FieldType.String, // Render as readonly string
    Object: FieldType.Unknown,
    Unknown: FieldType.Unknown,
  }
  return typeMap[zodType] || FieldType.Unknown
}

/**
 * Convert ZodFieldConstraints to FieldConstraints
 */
function convertZodConstraints(
  zodConstraints: ZodFieldConstraints
): FieldConstraints | undefined {
  const constraints: FieldConstraints = {}

  // Numeric constraints
  if (zodConstraints.min !== undefined) constraints.min = zodConstraints.min
  if (zodConstraints.max !== undefined) constraints.max = zodConstraints.max

  // Length constraints
  if (zodConstraints.length !== undefined) {
    constraints.minLength = zodConstraints.length
    constraints.maxLength = zodConstraints.length
  }
  if (zodConstraints.minLength !== undefined)
    constraints.minLength = zodConstraints.minLength
  if (zodConstraints.maxLength !== undefined)
    constraints.maxLength = zodConstraints.maxLength

  // Pattern (regex)
  if (zodConstraints.regex !== undefined)
    constraints.pattern = zodConstraints.regex

  // Format constraints
  if (zodConstraints.email) constraints.format = 'email'
  if (zodConstraints.url) constraints.format = 'uri'

  return Object.keys(constraints).length > 0 ? constraints : undefined
}

/**
 * Convert ZodField to SchemaField
 */
function zodFieldToSchemaField(zodField: ZodField): SchemaField {
  return {
    name: zodField.name,
    label: camelCaseToTitleCase(zodField.name),
    type: zodFieldTypeToFieldType(zodField.type),
    required: !zodField.optional,
    ...(zodField.constraints && {
      constraints: convertZodConstraints(zodField.constraints),
    }),
    ...(zodField.options && { enumValues: zodField.options }),
    ...(zodField.default && { default: zodField.default }),
    ...(zodField.arrayType && {
      subType: zodFieldTypeToFieldType(zodField.arrayType),
    }),
  }
}

/**
 * Parse the schema JSON string from the backend into typed schema information.
 * Now returns SchemaField[] for consistency with JSON schema parser.
 */
export function parseSchemaJson(
  schemaJson: string
): { fields: SchemaField[] } | null {
  try {
    const parsed: unknown = JSON.parse(schemaJson)

    // Type guard to check if parsed object has expected structure
    if (!isValidParsedSchema(parsed)) {
      return null
    }

    // Parse into intermediate ZodField format
    const zodFields: ZodField[] = parsed.fields.map(field => ({
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

    // Convert to SchemaField format
    const schemaFields = zodFields.map(zodFieldToSchemaField)

    return {
      fields: schemaFields,
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
