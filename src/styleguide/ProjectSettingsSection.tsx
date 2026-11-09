import type { Collection } from '@/lib/bindings'
import { FieldType, type CompleteSchema } from '../lib/schema'
import { CollectionPage } from '../components/project-settings/CollectionPage'

const PROJECT = '/Users/writer/sites/blog'

const SCHEMA: CompleteSchema = {
  collectionName: 'posts',
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: FieldType.String,
      required: true,
      constraints: { maxLength: 80 },
    },
    {
      name: 'published',
      label: 'Published',
      type: FieldType.Date,
      required: true,
      description: 'When the post went live',
    },
    {
      name: 'cover',
      label: 'Cover',
      type: FieldType.Image,
      required: false,
    },
    {
      name: 'mood',
      label: 'Mood',
      type: FieldType.Enum,
      required: false,
      enumValues: ['calm', 'busy'],
      default: 'calm',
    },
    {
      name: 'tags',
      label: 'Tags',
      type: FieldType.Array,
      subType: FieldType.String,
      required: false,
      constraints: { maxItems: 5 },
    },
    {
      name: 'author',
      label: 'Author',
      type: FieldType.Reference,
      reference: 'authors',
      required: true,
    },
    {
      name: 'links',
      label: 'Links',
      type: FieldType.Object,
      required: false,
    },
  ],
}

/** A collection with an unknown loader and no draft field, so it has notes to show */
const COLLECTION: Collection = {
  name: 'posts',
  kind: 'unknown',
  path: `${PROJECT}/src/content/posts`,
  base: `${PROJECT}/src/content/posts`,
  patterns: null,
  patternError: null,
  folderSource: 'convention',
  folderStatus: 'ok',
  schemaStatus: 'complete',
  schemaError: null,
  completeSchema: null,
  settings: {
    skippedFiles: { value: 'hide', source: 'convention' },
    titleField: { value: 'title', source: 'schema' },
    descriptionField: { value: null, source: 'missing' },
    publishedDateField: { value: ['published'], source: 'set' },
    draftField: { value: null, source: 'missing' },
    defaultSort: null,
    newFileType: { value: 'md', source: 'global' },
    urlPattern: null,
    assetsDirectory: { value: 'src/assets', source: 'convention' },
    useAbsoluteAssetPaths: { value: false, source: 'convention' },
  },
}

/** A collection's page in the project settings dialog */
export function ProjectSettingsSection() {
  return (
    <div className="max-w-2xl rounded-lg border p-4">
      <CollectionPage
        collection={COLLECTION}
        schema={SCHEMA}
        projectPath={PROJECT}
      />
    </div>
  )
}
