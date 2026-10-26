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

// The fields read their values from the editor store, as in the frontmatter panel
useEditorStore.setState({ frontmatter: FRONTMATTER })

export function FieldsSection() {
  return (
    <div className="flex items-start gap-8">
      {FIELDS.map((column, i) => (
        <div key={i} className="w-80 space-y-6">
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
}
