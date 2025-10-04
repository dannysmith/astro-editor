import { describe, it, expect } from 'vitest'
import { parseJsonSchema } from './parseJsonSchema'
import { FieldType } from './schema'

describe('parseJsonSchema', () => {
  describe('Basic Types', () => {
    it('should parse string fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              $schema: { type: 'string' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields).toHaveLength(1) // $schema should be skipped
      expect(result!.fields[0]).toMatchObject({
        name: 'title',
        type: FieldType.String,
        required: true,
      })
    })

    it('should parse number and integer fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
              price: { type: 'number' },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields).toHaveLength(2)

      const countField = result!.fields.find(f => f.name === 'count')
      expect(countField).toBeDefined()
      expect(countField!).toMatchObject({
        name: 'count',
        type: FieldType.Integer,
        required: false,
      })

      const priceField = result!.fields.find(f => f.name === 'price')
      expect(priceField).toBeDefined()
      expect(priceField!).toMatchObject({
        name: 'price',
        type: FieldType.Number,
        required: false,
      })
    })

    it('should parse boolean fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              draft: { type: 'boolean', default: false },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'draft',
        type: FieldType.Boolean,
        required: false,
        default: false,
      })
    })

    it('should parse date fields from anyOf', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              pubDate: {
                anyOf: [
                  { type: 'string', format: 'date-time' },
                  { type: 'string', format: 'date' },
                  { type: 'integer', format: 'unix-time' },
                ],
              },
            },
            required: ['pubDate'],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'pubDate',
        type: FieldType.Date,
        required: true,
      })
    })
  })

  describe('String Formats', () => {
    it('should parse email fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'email',
        type: FieldType.Email,
      })
    })

    it('should parse URL fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              website: { type: 'string', format: 'uri' },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'website',
        type: FieldType.URL,
      })
    })
  })

  describe('Enums', () => {
    it('should parse enum fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              platform: {
                type: 'string',
                enum: ['medium', 'external'],
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'platform',
        type: FieldType.Enum,
        enumValues: ['medium', 'external'],
      })
    })
  })

  describe('Arrays', () => {
    it('should parse array of strings', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'tags',
        type: FieldType.Array,
        subType: FieldType.String,
      })
    })

    it('should parse tuples as strings for V1', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              coordinates: {
                type: 'array',
                minItems: 2,
                maxItems: 2,
                items: [{ type: 'number' }, { type: 'number' }],
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'coordinates',
        type: FieldType.String, // Tuples rendered as strings for V1
      })
    })
  })

  describe('Constraints', () => {
    it('should extract string length constraints', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                minLength: 5,
                maxLength: 100,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toBeDefined()
      expect(result!.fields[0]!.constraints).toMatchObject({
        minLength: 5,
        maxLength: 100,
      })
    })

    it('should extract numeric constraints', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              count: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toBeDefined()
      expect(result!.fields[0]!.constraints).toMatchObject({
        min: 0,
        max: 100,
      })
    })

    it('should handle exclusive constraints', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              positive: {
                type: 'integer',
                exclusiveMinimum: 0,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toBeDefined()
      expect(result!.fields[0]!.constraints).toMatchObject({
        min: 1, // exclusiveMinimum: 0 becomes min: 1
      })
    })

    it('should extract array item constraints', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toBeDefined()
      expect(result!.fields[0]!.constraints).toMatchObject({
        minLength: 1,
        maxLength: 5,
      })
    })
  })

  describe('Metadata', () => {
    it('should extract descriptions', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'The article title',
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'title',
        description: 'The article title',
      })
    })

    it('should extract default values', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              draft: {
                type: 'boolean',
                default: false,
              },
              author: {
                type: 'string',
                default: 'Anonymous',
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()

      const draftField = result!.fields.find(f => f.name === 'draft')
      expect(draftField).toMatchObject({
        default: false,
        required: false,
      })

      const authorField = result!.fields.find(f => f.name === 'author')
      expect(authorField).toMatchObject({
        default: 'Anonymous',
        required: false,
      })
    })
  })

  describe('Nested Objects (Flattened)', () => {
    it('should flatten nested objects with dot notation', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              seo: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['title'],
                additionalProperties: false,
              },
            },
            required: ['seo'],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields).toHaveLength(2)

      const titleField = result!.fields.find(f => f.name === 'seo.title')
      expect(titleField).toMatchObject({
        name: 'seo.title',
        type: FieldType.String,
        required: true,
      })

      const descField = result!.fields.find(f => f.name === 'seo.description')
      expect(descField).toMatchObject({
        name: 'seo.description',
        type: FieldType.String,
        required: false,
      })
    })

    it('should handle deeply nested objects', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              author: {
                type: 'object',
                properties: {
                  social: {
                    type: 'object',
                    properties: {
                      twitter: { type: 'string' },
                    },
                    required: [],
                    additionalProperties: false,
                  },
                },
                required: [],
                additionalProperties: false,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields).toHaveLength(1)
      expect(result!.fields[0]).toMatchObject({
        name: 'author.social.twitter',
        type: FieldType.String,
      })
    })
  })

  describe('References', () => {
    it('should detect reference fields', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              author: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      collection: { type: 'string' },
                    },
                    required: ['id', 'collection'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      slug: { type: 'string' },
                      collection: { type: 'string' },
                    },
                    required: ['slug', 'collection'],
                    additionalProperties: false,
                  },
                ],
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'author',
        type: FieldType.Reference,
      })
    })
  })

  describe('Records and Unions', () => {
    it('should treat records as strings for V1', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              metadata: {
                type: 'object',
                additionalProperties: {
                  type: 'string',
                },
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'metadata',
        type: FieldType.String, // Records as strings for V1
      })
    })

    it('should treat unions as strings for V1', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              status: {
                anyOf: [{ type: 'string' }, { type: 'boolean' }],
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields[0]).toMatchObject({
        name: 'status',
        type: FieldType.String, // Unions as strings for V1
      })
    })
  })

  describe('Edge Cases', () => {
    it('should skip $schema metadata field', () => {
      const schema = {
        $ref: '#/definitions/test',
        definitions: {
          test: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              $schema: { type: 'string' },
            },
            required: [],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).not.toBeNull()
      expect(result!.fields).toHaveLength(1)
      expect(result!.fields[0]).toBeDefined()
      expect(result!.fields[0]!.name).toBe('title')
    })

    it('should handle invalid JSON gracefully', () => {
      const result = parseJsonSchema('invalid json')
      expect(result).toBeNull()
    })

    it('should handle missing definitions gracefully', () => {
      const schema = {
        $ref: '#/definitions/missing',
        definitions: {},
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(schema))
      expect(result).toBeNull()
    })
  })

  describe('Real-world Schemas', () => {
    it('should parse articles schema from dummy-astro-project', () => {
      const articlesSchema = {
        $ref: '#/definitions/articles',
        definitions: {
          articles: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              draft: { type: 'boolean', default: false },
              description: { type: 'string' },
              pubDate: {
                anyOf: [
                  { type: 'string', format: 'date-time' },
                  { type: 'string', format: 'date' },
                  { type: 'integer', format: 'unix-time' },
                ],
              },
              updatedDate: {
                anyOf: [
                  { type: 'string', format: 'date-time' },
                  { type: 'string', format: 'date' },
                  { type: 'integer', format: 'unix-time' },
                ],
              },
              cover: { type: 'string' },
              coverAlt: { type: 'string' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              platform: {
                type: 'string',
                enum: ['medium', 'external'],
              },
              $schema: { type: 'string' },
            },
            required: ['title', 'pubDate'],
            additionalProperties: false,
          },
        },
        $schema: 'http://json-schema.org/draft-07/schema#',
      }

      const result = parseJsonSchema(JSON.stringify(articlesSchema))
      expect(result).not.toBeNull()
      expect(result!.fields.length).toBeGreaterThan(0)

      const titleField = result!.fields.find(f => f.name === 'title')
      expect(titleField).toMatchObject({
        name: 'title',
        type: FieldType.String,
        required: true,
      })

      const draftField = result!.fields.find(f => f.name === 'draft')
      expect(draftField).toMatchObject({
        type: FieldType.Boolean,
        required: false,
        default: false,
      })

      const pubDateField = result!.fields.find(f => f.name === 'pubDate')
      expect(pubDateField).toMatchObject({
        type: FieldType.Date,
        required: true,
      })

      const tagsField = result!.fields.find(f => f.name === 'tags')
      expect(tagsField).toMatchObject({
        type: FieldType.Array,
        subType: FieldType.String,
      })

      const platformField = result!.fields.find(f => f.name === 'platform')
      expect(platformField).toMatchObject({
        type: FieldType.Enum,
        enumValues: ['medium', 'external'],
      })
    })
  })
})
