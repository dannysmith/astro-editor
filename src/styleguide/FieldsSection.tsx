import React from 'react'
import { useEditorStore } from '../store/editorStore'
import { FieldType, type SchemaField } from '../lib/schema'
import { FrontmatterField } from '../components/frontmatter/fields'

/** One field of each type, laid out in frontmatter-panel-width columns. */
const FIELDS: SchemaField[][] = [
  [
    {
      name: 'title',
      label: 'Title',
      type: FieldType.String,
      required: true,
      description: 'This is the title of the article',
      constraints: { minLength: 3, maxLength: 100 },
    },
    {
      name: 'slug',
      label: 'Slug',
      type: FieldType.String,
      required: false,
      constraints: { minLength: 3, maxLength: 50 },
    },
    {
      name: 'summary',
      label: 'Summary',
      type: FieldType.String,
      required: true,
    },
    {
      name: 'description',
      label: 'Description',
      type: FieldType.String,
      required: false,
      description: 'A brief description of the article',
    },
  ],
  [
    { name: 'draft', label: 'Draft', type: FieldType.Boolean, required: false },
    {
      name: 'pubDate',
      label: 'Pub Date',
      type: FieldType.Date,
      required: true,
    },
    {
      name: 'category',
      label: 'Category',
      type: FieldType.Enum,
      required: false,
      enumValues: ['tutorial', 'guide', 'reference'],
    },
    {
      name: 'tags',
      label: 'Tags',
      type: FieldType.Array,
      subType: FieldType.String,
      required: false,
    },
    {
      name: 'readingTime',
      label: 'Reading Time',
      type: FieldType.Number,
      required: false,
    },
  ],
  [
    { name: 'cover', label: 'Cover', type: FieldType.Image, required: false },
    {
      name: 'gallery',
      label: 'Gallery',
      type: FieldType.Array,
      subType: FieldType.Image,
      required: false,
    },
    { name: 'website', label: 'Website', type: FieldType.URL, required: false },
    {
      name: 'author',
      label: 'Author',
      type: FieldType.Reference,
      reference: 'authors',
      required: false,
    },
    {
      name: 'related',
      label: 'Related Articles',
      type: FieldType.Array,
      subReference: 'articles',
      required: false,
    },
    {
      name: 'links',
      label: 'Links',
      type: FieldType.Array,
      subType: FieldType.Object,
      required: false,
    },
  ],
]

const FRONTMATTER = {
  title: 'Getting Started with Astro',
  slug: 'getting-started',
  description:
    'A walkthrough of content collections, from schema to first post.',
  draft: true,
  pubDate: '2024-01-15',
  category: 'tutorial',
  tags: ['astro', 'markdown'],
  readingTime: 7,
  website: 'https://astro.build',
  links: [{ label: 'Docs', url: 'https://docs.astro.build' }],
}

const stateField = (
  name: string,
  label: string,
  type: FieldType,
  rest: Partial<SchemaField> = {}
): SchemaField => ({ name, label, type, required: false, ...rest })

/** What each kind of constraint looks like, met and not */
const FIELD_STATES: SchemaField[][] = [
  [
    stateField('lengthOk', 'Length', FieldType.String, {
      constraints: { minLength: 3, maxLength: 50 },
    }),
    stateField('lengthOver', 'Too long', FieldType.String, {
      constraints: { maxLength: 24 },
    }),
    stateField('lengthShort', 'Too short', FieldType.String, {
      constraints: { minLength: 3, maxLength: 50 },
    }),
    stateField('exact', 'Exact length', FieldType.String, {
      constraints: { minLength: 5, maxLength: 5 },
    }),
    stateField('patternOk', 'Pattern', FieldType.String, {
      constraints: { pattern: '^[A-Z]{3}$' },
    }),
    stateField('patternBad', 'Pattern, not met', FieldType.String, {
      constraints: { pattern: '^[A-Z]{3}$' },
    }),
  ],
  [
    stateField('rangeOk', 'Range', FieldType.Number, {
      constraints: { min: 1, max: 10 },
    }),
    stateField('rangeBad', 'Out of range', FieldType.Number, {
      constraints: { min: 1, max: 10 },
    }),
    stateField('positive', 'Exclusive bound', FieldType.Number, {
      constraints: { min: 0, minExclusive: true },
    }),
    stateField('whole', 'Whole number', FieldType.Integer, {
      constraints: { min: 0 },
    }),
    stateField('urlOk', 'URL', FieldType.URL),
    stateField('urlBad', 'URL, not met', FieldType.URL),
    stateField('emailBad', 'Email, not met', FieldType.Email),
  ],
  [
    stateField('listOk', 'List', FieldType.Array, {
      subType: FieldType.String,
      constraints: { minItems: 1, maxItems: 5 },
    }),
    stateField('listOver', 'Too many', FieldType.Array, {
      subType: FieldType.String,
      constraints: { maxItems: 2 },
    }),
    stateField('choiceBad', 'Not an option', FieldType.Enum, {
      enumValues: ['tutorial', 'guide'],
    }),
    stateField('dateBad', 'Not a date', FieldType.Date),
    stateField('defaulted', 'Has a default', FieldType.String, {
      default: 'guide',
    }),
  ],
  [
    stateField('requiredText', 'Required text', FieldType.String, {
      required: true,
    }),
    stateField('requiredLimited', 'Required, limited', FieldType.String, {
      required: true,
      constraints: { maxLength: 60 },
    }),
    stateField('requiredDate', 'Required date', FieldType.Date, {
      required: true,
    }),
    stateField('requiredChoice', 'Required choice', FieldType.Enum, {
      required: true,
      enumValues: ['tutorial', 'guide'],
    }),
    stateField('requiredList', 'Required list', FieldType.Array, {
      required: true,
      subType: FieldType.String,
    }),
    stateField('requiredImage', 'Required image', FieldType.Image, {
      required: true,
    }),
    stateField('requiredToggle', 'Required toggle', FieldType.Boolean, {
      required: true,
    }),
  ],
]

const STATE_VALUES = {
  lengthOk: 'Within its limits',
  lengthOver: "A title that's a little too long",
  lengthShort: 'ab',
  exact: 'abcde',
  patternOk: 'ABC',
  patternBad: 'abc',
  rangeOk: 7,
  rangeBad: 14,
  positive: 2.5,
  whole: 3.5,
  urlOk: 'https://astro.build',
  urlBad: 'astro build',
  emailBad: 'not an email',
  listOk: ['astro', 'markdown'],
  listOver: ['astro', 'markdown', 'mdx'],
  choiceBad: 'archived',
  dateBad: 'next tuesday',
}

// The fields read their values from the editor store, as in the frontmatter
// panel. The store ignores edits until a file has loaded
useEditorStore.setState({
  frontmatter: { ...FRONTMATTER, ...STATE_VALUES },
  isLoaded: true,
})

const FieldColumns: React.FC<{
  columns: SchemaField[][]
  className: string
}> = ({ columns, className }) => (
  <div className="flex items-start gap-8">
    {columns.map((column, i) => (
      <div key={i} className={className}>
        {column.map(field => (
          <FrontmatterField
            key={field.name}
            name={field.name}
            label={field.label}
            field={field}
          />
        ))}
      </div>
    ))}
  </div>
)

export function FieldsSection() {
  return <FieldColumns columns={FIELDS} className="w-80 space-y-6" />
}

/** Each kind of constraint, met and not, and empty required fields */
export function FieldStatesSection() {
  return <FieldColumns columns={FIELD_STATES} className="w-60 space-y-5" />
}
