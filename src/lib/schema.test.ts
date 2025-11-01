import { describe, it, expect } from 'vitest'
import {
  deserializeCompleteSchema,
  FieldType,
  type CompleteSchema,
} from './schema'

// Helper to assert result is not null and return typed result
function assertResult(
  result: CompleteSchema | null
): asserts result is CompleteSchema {
  expect(result).not.toBeNull()
  if (!result) throw new Error('Result should not be null')
}

describe('deserializeCompleteSchema', () => {
  describe('Field Type Mapping', () => {
    it('should map string type correctly', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.type).toBe(FieldType.String)
    })

    it('should map all field types correctly', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'test',
        fields: [
          {
            name: 'str',
            label: 'String',
            fieldType: 'string',
            required: false,
          },
          {
            name: 'num',
            label: 'Number',
            fieldType: 'number',
            required: false,
          },
          {
            name: 'int',
            label: 'Integer',
            fieldType: 'integer',
            required: false,
          },
          {
            name: 'bool',
            label: 'Boolean',
            fieldType: 'boolean',
            required: false,
          },
          { name: 'date', label: 'Date', fieldType: 'date', required: false },
          {
            name: 'email',
            label: 'Email',
            fieldType: 'email',
            required: false,
          },
          { name: 'url', label: 'URL', fieldType: 'url', required: false },
          { name: 'img', label: 'Image', fieldType: 'image', required: false },
          { name: 'arr', label: 'Array', fieldType: 'array', required: false },
          { name: 'enum', label: 'Enum', fieldType: 'enum', required: false },
          {
            name: 'ref',
            label: 'Reference',
            fieldType: 'reference',
            required: false,
          },
          {
            name: 'obj',
            label: 'Object',
            fieldType: 'object',
            required: false,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.type).toBe(FieldType.String)
      expect(result.fields[1]!.type).toBe(FieldType.Number)
      expect(result.fields[2]!.type).toBe(FieldType.Integer)
      expect(result.fields[3]!.type).toBe(FieldType.Boolean)
      expect(result.fields[4]!.type).toBe(FieldType.Date)
      expect(result.fields[5]!.type).toBe(FieldType.Email)
      expect(result.fields[6]!.type).toBe(FieldType.URL)
      expect(result.fields[7]!.type).toBe(FieldType.Image)
      expect(result.fields[8]!.type).toBe(FieldType.Array)
      expect(result.fields[9]!.type).toBe(FieldType.Enum)
      expect(result.fields[10]!.type).toBe(FieldType.Reference)
      expect(result.fields[11]!.type).toBe(FieldType.Object)
    })

    it('should default unknown types to FieldType.Unknown', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'weird',
            label: 'Weird Field',
            fieldType: 'something-unknown',
            required: false,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.type).toBe(FieldType.Unknown)
    })

    it('should map array subType correctly', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'tags',
            label: 'Tags',
            fieldType: 'array',
            subType: 'string',
            required: false,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.type).toBe(FieldType.Array)
      expect(result.fields[0]!.subType).toBe(FieldType.String)
    })

    it('should handle array with reference subType', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'relatedPosts',
            label: 'Related Posts',
            fieldType: 'array',
            subType: 'reference',
            arrayReferenceCollection: 'posts',
            required: false,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.type).toBe(FieldType.Array)
      expect(result.fields[0]!.subType).toBe(FieldType.Reference)
      expect(result.fields[0]!.subReference).toBe('posts')
    })
  })

  describe('Field Properties', () => {
    it('should parse required fields correctly', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
          },
          {
            name: 'subtitle',
            label: 'Subtitle',
            fieldType: 'string',
            required: false,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.required).toBe(true)
      expect(result.fields[1]!.required).toBe(false)
    })

    it('should parse optional field properties', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
            description: 'The post title',
            default: 'Untitled',
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.description).toBe('The post title')
      expect(result.fields[0]!.default).toBe('Untitled')
    })

    it('should parse enum values', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'status',
            label: 'Status',
            fieldType: 'enum',
            required: true,
            enumValues: ['draft', 'published', 'archived'],
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.enumValues).toEqual([
        'draft',
        'published',
        'archived',
      ])
    })

    it('should parse all constraint types', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
            constraints: {
              minLength: 3,
              maxLength: 100,
              pattern: '^[A-Z]',
            },
          },
          {
            name: 'rating',
            label: 'Rating',
            fieldType: 'number',
            required: false,
            constraints: {
              min: 0,
              max: 5,
            },
          },
          {
            name: 'email',
            label: 'Email',
            fieldType: 'string',
            required: false,
            constraints: {
              format: 'email',
            },
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)

      // String constraints
      expect(result.fields[0]!.constraints).toEqual({
        minLength: 3,
        maxLength: 100,
        pattern: '^[A-Z]',
      })

      // Number constraints
      expect(result.fields[1]!.constraints).toEqual({
        min: 0,
        max: 5,
      })

      // Format constraint
      expect(result.fields[2]!.constraints).toEqual({
        format: 'email',
      })
    })

    it('should parse reference collection', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'author',
            label: 'Author',
            fieldType: 'reference',
            required: true,
            referenceCollection: 'authors',
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.reference).toBe('authors')
      expect(result.fields[0]!.referenceCollection).toBe('authors')
    })

    it('should parse array reference collection', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'tags',
            label: 'Tags',
            fieldType: 'array',
            subType: 'reference',
            required: false,
            arrayReferenceCollection: 'tags',
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.subReference).toBe('tags')
    })

    it('should parse nested field properties', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'author.name',
            label: 'Author Name',
            fieldType: 'string',
            required: true,
            isNested: true,
            parentPath: 'author',
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.isNested).toBe(true)
      expect(result.fields[0]!.parentPath).toBe('author')
      expect(result.fields[0]!.name).toBe('author.name')
    })
  })

  describe('Error Handling', () => {
    it('should return null for malformed JSON', () => {
      const malformedJson = '{ this is not valid json }'

      const result = deserializeCompleteSchema(malformedJson)

      expect(result).toBeNull()
    })

    it('should return null when collectionName is missing', () => {
      const invalidSchema = JSON.stringify({
        // Missing collectionName
        fields: [],
      })

      const result = deserializeCompleteSchema(invalidSchema)

      // Should reject schemas without required collectionName
      expect(result).toBeNull()
    })

    it('should return null when collectionName is empty string', () => {
      const invalidSchema = JSON.stringify({
        collectionName: '',
        fields: [],
      })

      const result = deserializeCompleteSchema(invalidSchema)

      expect(result).toBeNull()
    })

    it('should return null when collectionName is whitespace only', () => {
      const invalidSchema = JSON.stringify({
        collectionName: '   ',
        fields: [],
      })

      const result = deserializeCompleteSchema(invalidSchema)

      expect(result).toBeNull()
    })

    it('should return null when collectionName is not a string', () => {
      const invalidSchema = JSON.stringify({
        collectionName: 123,
        fields: [],
      })

      const result = deserializeCompleteSchema(invalidSchema)

      expect(result).toBeNull()
    })

    it('should return null when fields is not an array', () => {
      const invalidSchema = JSON.stringify({
        collectionName: 'posts',
        fields: 'not an array',
      })

      const result = deserializeCompleteSchema(invalidSchema)

      expect(result).toBeNull()
    })

    it('should return null when fields is missing', () => {
      const invalidSchema = JSON.stringify({
        collectionName: 'posts',
        // Missing fields
      })

      const result = deserializeCompleteSchema(invalidSchema)

      expect(result).toBeNull()
    })

    it('should handle missing optional fields gracefully', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
            // No description, default, enumValues, etc.
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.description).toBeUndefined()
      expect(result.fields[0]!.default).toBeUndefined()
      expect(result.fields[0]!.enumValues).toBeUndefined()
      expect(result.fields[0]!.constraints).toBeUndefined()
    })

    it('should handle empty string as valid JSON', () => {
      const result = deserializeCompleteSchema('')

      expect(result).toBeNull()
    })

    it('should handle null input', () => {
      const result = deserializeCompleteSchema('null')

      expect(result).toBeNull()
    })

    it('should handle array instead of object', () => {
      const arrayJson = JSON.stringify([
        { collectionName: 'posts', fields: [] },
      ])

      const result = deserializeCompleteSchema(arrayJson)

      expect(result).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty fields array', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.collectionName).toBe('posts')
      expect(result.fields).toHaveLength(0)
    })

    it('should handle deeply nested object structures', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'seo.og.image',
            label: 'OG Image',
            fieldType: 'image',
            required: false,
            isNested: true,
            parentPath: 'seo.og',
          },
          {
            name: 'seo.og.title',
            label: 'OG Title',
            fieldType: 'string',
            required: false,
            isNested: true,
            parentPath: 'seo.og',
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields).toHaveLength(2)
      expect(result.fields[0]!.name).toBe('seo.og.image')
      expect(result.fields[0]!.parentPath).toBe('seo.og')
      expect(result.fields[1]!.name).toBe('seo.og.title')
      expect(result.fields[1]!.parentPath).toBe('seo.og')
    })

    it('should preserve backwards compatibility with referenceCollection', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'author',
            label: 'Author',
            fieldType: 'reference',
            required: true,
            referenceCollection: 'authors',
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      // Both reference and referenceCollection should be set
      expect(result.fields[0]!.reference).toBe('authors')
      expect(result.fields[0]!.referenceCollection).toBe('authors')
    })

    it('should handle field with all properties defined', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Post Title',
            fieldType: 'string',
            required: true,
            description: 'The main title of the post',
            default: 'Untitled Post',
            constraints: {
              minLength: 1,
              maxLength: 200,
              pattern: '^[A-Za-z]',
            },
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]).toEqual({
        name: 'title',
        label: 'Post Title',
        type: FieldType.String,
        subType: undefined,
        required: true,
        description: 'The main title of the post',
        default: 'Untitled Post',
        constraints: {
          minLength: 1,
          maxLength: 200,
          pattern: '^[A-Za-z]',
        },
        enumValues: undefined,
        reference: undefined,
        subReference: undefined,
        referenceCollection: undefined,
        isNested: undefined,
        parentPath: undefined,
      })
    })

    it('should handle complex real-world schema', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'blog',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
            constraints: { minLength: 3, maxLength: 100 },
          },
          {
            name: 'publishedDate',
            label: 'Published Date',
            fieldType: 'date',
            required: true,
          },
          {
            name: 'author',
            label: 'Author',
            fieldType: 'reference',
            required: true,
            referenceCollection: 'authors',
          },
          {
            name: 'tags',
            label: 'Tags',
            fieldType: 'array',
            subType: 'string',
            required: false,
          },
          {
            name: 'relatedPosts',
            label: 'Related Posts',
            fieldType: 'array',
            subType: 'reference',
            arrayReferenceCollection: 'blog',
            required: false,
          },
          {
            name: 'coverImage',
            label: 'Cover Image',
            fieldType: 'image',
            required: false,
          },
          {
            name: 'status',
            label: 'Status',
            fieldType: 'enum',
            required: true,
            enumValues: ['draft', 'published', 'archived'],
            default: 'draft',
          },
          {
            name: 'featured',
            label: 'Featured',
            fieldType: 'boolean',
            required: false,
            default: false,
          },
          {
            name: 'seo.title',
            label: 'SEO Title',
            fieldType: 'string',
            required: false,
            isNested: true,
            parentPath: 'seo',
            constraints: { maxLength: 60 },
          },
          {
            name: 'seo.description',
            label: 'SEO Description',
            fieldType: 'string',
            required: false,
            isNested: true,
            parentPath: 'seo',
            constraints: { maxLength: 160 },
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.collectionName).toBe('blog')
      expect(result.fields).toHaveLength(10)

      // Spot check key fields
      expect(result.fields[0]!.type).toBe(FieldType.String)
      expect(result.fields[1]!.type).toBe(FieldType.Date)
      expect(result.fields[2]!.type).toBe(FieldType.Reference)
      expect(result.fields[2]!.reference).toBe('authors')
      expect(result.fields[3]!.type).toBe(FieldType.Array)
      expect(result.fields[3]!.subType).toBe(FieldType.String)
      expect(result.fields[4]!.subReference).toBe('blog')
      expect(result.fields[5]!.type).toBe(FieldType.Image)
      expect(result.fields[6]!.type).toBe(FieldType.Enum)
      expect(result.fields[6]!.enumValues).toEqual([
        'draft',
        'published',
        'archived',
      ])
      expect(result.fields[7]!.type).toBe(FieldType.Boolean)
      expect(result.fields[8]!.isNested).toBe(true)
      expect(result.fields[9]!.parentPath).toBe('seo')
    })

    it('should handle undefined constraints', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
            constraints: undefined,
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.constraints).toBeUndefined()
    })

    it('should handle empty constraints object', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
            constraints: {},
          },
        ],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.fields[0]!.constraints).toEqual({})
    })
  })

  describe('Collection Name', () => {
    it('should preserve collection name', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'my-custom-collection',
        fields: [],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.collectionName).toBe('my-custom-collection')
    })

    it('should handle collection names with special characters', () => {
      const schemaJson = JSON.stringify({
        collectionName: 'blog_posts-2024',
        fields: [],
      })

      const result = deserializeCompleteSchema(schemaJson)

      assertResult(result)
      expect(result.collectionName).toBe('blog_posts-2024')
    })
  })
})
