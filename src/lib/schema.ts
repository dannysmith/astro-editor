// Complete schema from Rust backend
export interface CompleteSchema {
  collectionName: string
  fields: SchemaField[]
}

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

// Type for raw schema from Rust backend
interface RawCompleteSchema {
  collectionName: string
  fields: Array<{
    name: string
    label: string
    fieldType: string
    subType?: string
    required: boolean
    constraints?: FieldConstraints
    description?: string
    default?: unknown
    enumValues?: string[]
    referenceCollection?: string
    arrayReferenceCollection?: string
    isNested?: boolean
    parentPath?: string
  }>
}

/**
 * Deserialize complete schema from Rust backend
 */
export function deserializeCompleteSchema(
  schemaJson: string
): CompleteSchema | null {
  try {
    const parsed = JSON.parse(schemaJson) as RawCompleteSchema

    // Map Rust field types to FieldType enum
    const fields = parsed.fields.map(field => ({
      name: field.name,
      label: field.label,
      type: fieldTypeFromString(field.fieldType),
      subType: field.subType ? fieldTypeFromString(field.subType) : undefined,
      required: field.required,
      constraints: field.constraints,
      description: field.description,
      default: field.default,
      enumValues: field.enumValues,
      reference: field.referenceCollection,
      subReference: field.arrayReferenceCollection,
      referenceCollection: field.referenceCollection, // Backwards compat
      isNested: field.isNested,
      parentPath: field.parentPath,
    }))

    return {
      collectionName: parsed.collectionName,
      fields,
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Failed to deserialize complete schema:', error)
    }
    return null
  }
}

function fieldTypeFromString(typeStr: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    string: FieldType.String,
    number: FieldType.Number,
    integer: FieldType.Integer,
    boolean: FieldType.Boolean,
    date: FieldType.Date,
    email: FieldType.Email,
    url: FieldType.URL,
    array: FieldType.Array,
    enum: FieldType.Enum,
    reference: FieldType.Reference,
    object: FieldType.Object,
    unknown: FieldType.Unknown,
  }
  return typeMap[typeStr] || FieldType.Unknown
}
