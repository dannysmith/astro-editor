import { describe, it, expect } from 'vitest'
import { parseSchemaJson, FieldType } from './schema'

describe('Schema Utilities', () => {
  describe('parseSchemaJson', () => {
    it('should parse valid schema JSON and convert to SchemaField format', () => {
      const schemaJson = JSON.stringify({
        type: 'zod',
        fields: [
          { name: 'title', type: 'String', optional: false },
          {
            name: 'description',
            type: 'String',
            optional: true,
            default: 'Default description',
          },
          { name: 'count', type: 'Number', optional: false },
          { name: 'published', type: 'Boolean', optional: true },
        ],
      })

      const result = parseSchemaJson(schemaJson)

      expect(result).not.toBeNull()
      expect(result?.fields).toHaveLength(4)
      expect(result?.fields[0]).toMatchObject({
        name: 'title',
        label: 'Title',
        type: FieldType.String,
        required: true,
      })
      expect(result?.fields[1]).toMatchObject({
        name: 'description',
        label: 'Description',
        type: FieldType.String,
        required: false,
        default: 'Default description',
      })
      expect(result?.fields[2]).toMatchObject({
        name: 'count',
        label: 'Count',
        type: FieldType.Number,
        required: true,
      })
      expect(result?.fields[3]).toMatchObject({
        name: 'published',
        label: 'Published',
        type: FieldType.Boolean,
        required: false,
      })
    })

    it('should return null for invalid JSON', () => {
      const result = parseSchemaJson('invalid json')
      expect(result).toBeNull()
    })

    it('should return null for non-zod schema', () => {
      const schemaJson = JSON.stringify({
        type: 'other',
        fields: [],
      })

      const result = parseSchemaJson(schemaJson)
      expect(result).toBeNull()
    })

    it('should return null for schema without fields array', () => {
      const schemaJson = JSON.stringify({
        type: 'zod',
        fields: 'not an array',
      })

      const result = parseSchemaJson(schemaJson)
      expect(result).toBeNull()
    })
  })
})
