import type {
  Collection,
  ProjectScan,
  ResolvedProjectSettings,
} from '@/lib/bindings'

/**
 * A browsable glob collection in `/site/src/content/<name>`, with every setting
 * at its convention, as `scan_project` resolves one with no schema
 */
export function makeCollection(
  overrides: Partial<Collection> & { name: string }
): Collection {
  const path = `/site/src/content/${overrides.name}`
  return {
    kind: 'glob',
    path,
    base: path,
    patterns: ['**/[^_]*.{md,mdx}'],
    patternError: null,
    folderSource: 'config',
    folderStatus: 'ok',
    schemaStatus: 'none',
    schemaError: null,
    completeSchema: null,
    settings: {
      skippedFiles: { value: 'hide', source: 'convention' },
      titleField: { value: 'title', source: 'convention' },
      descriptionField: { value: 'description', source: 'convention' },
      publishedDateField: {
        value: ['pubDate', 'date', 'publishedDate'],
        source: 'convention',
      },
      draftField: { value: 'draft', source: 'convention' },
      defaultSort: { value: null, source: 'convention' },
      newFileType: { value: 'md', source: 'global' },
      urlPattern: { value: null, source: 'convention' },
      assetsDirectory: { value: 'src/assets', source: 'convention' },
      useAbsoluteAssetPaths: { value: false, source: 'convention' },
    },
    ...overrides,
  }
}

/** A project scan with these collections and conventional project settings */
export function makeScan(
  collections: Collection[],
  projectSettings: Partial<ResolvedProjectSettings> = {}
): ProjectScan {
  return {
    configPath: 'src/content.config.ts',
    configError: null,
    fallback: false,
    projectSettings: {
      contentDirectory: { value: 'src/content', source: 'convention' },
      mdxComponentsDirectory: {
        value: 'src/components/mdx',
        source: 'convention',
      },
      addComponentImports: { value: false, source: 'convention' },
      assetsDirectory: { value: 'src/assets', source: 'convention' },
      useAbsoluteAssetPaths: { value: false, source: 'convention' },
      ...projectSettings,
    },
    collections,
  }
}
