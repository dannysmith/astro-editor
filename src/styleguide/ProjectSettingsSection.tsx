import type { Collection, ProjectScan } from '@/lib/bindings'
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

/**
 * A collection with an unreadable pattern and no draft field, so it has a
 * warning and a note to show
 */
const COLLECTION: Collection = {
  name: 'posts',
  kind: 'glob',
  loaderName: null,
  inlineLoader: false,
  path: `${PROJECT}/src/content/posts`,
  base: `${PROJECT}/src/content/posts`,
  patterns: null,
  patternError:
    "Couldn't read the pattern `**/*.@(md|mdx)`: extglobs aren't supported",
  folderSource: 'config',
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
    defaultSort: { value: null, source: 'convention' },
    newFileType: { value: 'md', source: 'global' },
    fileNamePattern: { value: '{YYYY-MM-DD}-{title}', source: 'set' },
    urlPattern: { value: '/blog/{slug}', source: 'set' },
    assetsDirectory: { value: 'src/assets', source: 'convention' },
    useAbsoluteAssetPaths: { value: false, source: 'convention' },
  },
}

const SCAN: ProjectScan = {
  configPath: 'src/content.config.ts',
  configError: null,
  fallback: false,
  favicon: null,
  projectSettings: {
    contentDirectory: { value: 'src/content', source: 'convention' },
    mdxComponentsDirectories: {
      value: ['src/components/mdx'],
      source: 'convention',
    },
    addComponentImports: { value: false, source: 'convention' },
    assetsDirectory: { value: 'src/assets', source: 'convention' },
    useAbsoluteAssetPaths: { value: false, source: 'convention' },
  },
  collections: [COLLECTION],
}

/** A collection's page in the project settings dialog */
export function ProjectSettingsSection() {
  return (
    <div className="max-w-3xl rounded-lg border p-6">
      <CollectionPage
        collection={COLLECTION}
        schema={SCHEMA}
        scan={SCAN}
        projectPath={PROJECT}
      />
    </div>
  )
}
