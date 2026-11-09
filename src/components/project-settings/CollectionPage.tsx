import type {
  Collection,
  CollectionSettings,
  FileType,
  Resolved,
} from '@/lib/bindings'
import { Switch } from '@/components/ui/switch'
import { usePreferences } from '../../hooks/usePreferences'
import { DOCS_URLS } from '../../lib/docs-urls'
import { getSortOptionsForCollection } from '../../lib/files/sorting'
import { FieldType, type CompleteSchema } from '../../lib/schema'
import { useCollectionFilesQuery } from '../../hooks/queries/useCollectionFilesQuery'
import {
  defaultSortChoices,
  frontmatterKeysOfType,
  LOADER_LABELS,
  SCHEMA_STATUS_LABELS,
} from '../../lib/project-settings/describe'
import {
  collectionProblems,
  relativePath,
} from '../../lib/project-settings/status'
import { SettingsSection } from '../preferences/SettingsSection'
import { PreferencesTextInput } from '../preferences/PreferencesTextInput'
import { DocsLink } from '../preferences/DocsLink'
import { ProblemList, WithCode } from './Problems'
import { FolderInput, Setting, SettingSelect } from './Setting'
import { SchemaFields } from './SchemaFields'
import { FileNamePatternInput } from './FileNamePatternInput'

type FieldSetting =
  | 'titleField'
  | 'descriptionField'
  | 'publishedDateField'
  | 'draftField'

const AUTOMATIC = 'automatic'

/** How AE has read a collection, its settings, and its schema's fields */
export function CollectionPage({
  collection,
  schema,
  projectPath,
}: {
  collection: Collection
  schema: CompleteSchema | null
  projectPath: string
}) {
  const { projectSettings, updateCollectionSettings, globalSettings } =
    usePreferences()
  const stored = projectSettings?.collections[collection.name] ?? {}
  const resolved = collection.settings
  const folder = relativePath(collection.path, projectPath)

  const update = (settings: Partial<CollectionSettings>) =>
    void updateCollectionSettings(collection.name, settings)
  const reset = (key: keyof CollectionSettings) => () =>
    update({ [key]: undefined })

  // Without a generated schema, field mappings offer the keys the files have
  const schemaComplete = collection.schemaStatus === 'complete'
  const { data: files = [] } = useCollectionFilesQuery(
    projectPath,
    schemaComplete ? undefined : collection
  )

  /**
   * A dropdown of the fields of a type, for a field mapping: the schema's, or
   * without a generated one, the keys the files have
   */
  const fieldSelect = (
    key: FieldSetting,
    type: FieldType.String | FieldType.Date | FieldType.Boolean,
    labelId: string
  ) => {
    const value: Resolved<string | string[] | null> = resolved[key]
    const detected = [value.value].flat().filter(Boolean).join(', ')
    const schemaFields = (schema?.fields ?? []).filter(f => f.type === type)
    const optional = new Set(
      schemaFields.filter(f => !f.required).map(f => f.name)
    )
    // The stored field too, in case it's no longer offered
    const names = new Set([
      ...schemaFields.map(f => f.name),
      ...(schemaComplete ? [] : frontmatterKeysOfType(files, type)),
      ...(stored[key] ? [stored[key]] : []),
    ])
    return (
      <SettingSelect
        labelId={labelId}
        value={stored[key] ?? AUTOMATIC}
        onChange={next =>
          update({ [key]: next === AUTOMATIC ? undefined : next })
        }
        choices={[
          {
            value: AUTOMATIC,
            label: (
              <span className="text-muted-foreground">
                Automatic
                {value.source !== 'set' && `: ${detected || 'none'}`}
              </span>
            ),
          },
          ...[...names].map(name => ({
            value: name,
            label: (
              <>
                {name}
                {optional.has(name) && (
                  <span className="ml-1 text-muted-foreground">(optional)</span>
                )}
              </>
            ),
          })),
        ]}
      />
    )
  }

  // Patterns like `**/index.md` give each entry a folder
  const folderPerEntry = Boolean(
    collection.patterns?.length &&
    collection.patterns.every(p => /(^|\/)index\.[^/]+$/.test(p))
  )

  const sortChoices = defaultSortChoices(getSortOptionsForCollection(schema))
  const defaultSort = resolved.defaultSort.value
  const sortValue = defaultSort
    ? `${defaultSort.mode}:${defaultSort.direction}`
    : AUTOMATIC

  return (
    <div className="space-y-6">
      <SettingsSection title="Status">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Loader</dt>
          <dd>
            <WithCode text={LOADER_LABELS[collection.kind]} />
          </dd>
          <dt className="text-muted-foreground">Pattern</dt>
          <dd>
            {collection.patterns ? (
              <WithCode
                text={collection.patterns.map(p => `\`${p}\``).join(', ')}
              />
            ) : (
              <WithCode text="Every Markdown file, except ones starting with `_`" />
            )}
          </dd>
          <dt className="text-muted-foreground">Schema</dt>
          <dd>
            <WithCode text={SCHEMA_STATUS_LABELS[collection.schemaStatus]} />
            {schemaComplete && schema && (
              <span className="text-muted-foreground">
                {' '}
                · {schema.fields.length} fields, listed below
              </span>
            )}
          </dd>
        </dl>
        <ProblemList problems={collectionProblems(collection, projectPath)} />
      </SettingsSection>

      <SettingsSection title="Files">
        <Setting
          label="Folder"
          source={collection.folderSource}
          onReset={reset('folder')}
          description={
            collection.kind === 'unknown' && collection.folderSource !== 'set'
              ? "Astro Editor can't read this collection's loader, so it looks in the content folder for a folder named after it. If the files are somewhere else, choose their folder."
              : "The folder you browse in the file list. Set it only if the collection's files are somewhere else."
          }
        >
          {({ id }) => (
            <FolderInput
              id={id}
              value={stored.folder ?? ''}
              placeholder={folder}
              start={
                collection.folderStatus === 'ok' ? collection.path : projectPath
              }
              onChange={value => update({ folder: value })}
            />
          )}
        </Setting>

        <Setting
          label="Files the Pattern Leaves Out"
          source={resolved.skippedFiles.source}
          onReset={reset('skippedFiles')}
          description={
            <WithCode text="Markdown files in the folder that aren't entries, like drafts named `_draft.md`. Shown dimmed, they open and edit as usual." />
          }
        >
          {({ labelId }) => (
            <SettingSelect
              labelId={labelId}
              value={resolved.skippedFiles.value}
              onChange={value =>
                update({ skippedFiles: value === 'dim' ? 'dim' : 'hide' })
              }
              choices={[
                { value: 'hide', label: 'Hide them' },
                { value: 'dim', label: 'Show them dimmed' },
              ]}
            />
          )}
        </Setting>

        <Setting
          label="New Files"
          source={resolved.newFileType.source}
          onReset={reset('defaultFileType')}
        >
          {({ labelId }) =>
            resolved.newFileType.source === 'config' ? (
              <p className="text-sm">
                <WithCode
                  text={`\`.${resolved.newFileType.value}\`, the only type the pattern includes.`}
                />
              </p>
            ) : (
              <SettingSelect
                labelId={labelId}
                value={stored.defaultFileType ?? AUTOMATIC}
                onChange={value =>
                  update({
                    defaultFileType:
                      value === AUTOMATIC ? undefined : (value as FileType),
                  })
                }
                choices={[
                  {
                    value: AUTOMATIC,
                    label: (
                      <span className="text-muted-foreground">
                        Global preference:{' '}
                        {globalSettings?.general.defaultFileType === 'mdx'
                          ? 'MDX'
                          : 'Markdown'}
                      </span>
                    ),
                  },
                  { value: 'md', label: 'Markdown (.md)' },
                  { value: 'mdx', label: 'MDX (.mdx)' },
                ]}
              />
            )
          }
        </Setting>

        <Setting
          label="File Names"
          source={resolved.fileNamePattern.source}
          onReset={reset('fileNamePattern')}
          description={
            <WithCode text="How new files are named. `{title}` is the title as a slug, added when you first give a new file a title. Other placeholders are dates, from the published date or today, written with `YYYY`, `YY`, `MM`, `M`, `DD` and `D`. The Rename File from Pattern command renames any file to match." />
          }
        >
          {({ id }) => (
            <FileNamePatternInput
              id={id}
              value={resolved.fileNamePattern.value}
              fileName={stem =>
                folderPerEntry
                  ? `${stem}/index.${resolved.newFileType.value}`
                  : `${stem}.${resolved.newFileType.value}`
              }
              onChange={pattern => update({ fileNamePattern: pattern })}
            />
          )}
        </Setting>

        <Setting
          label="Default Sort"
          source={resolved.defaultSort.source}
          onReset={reset('defaultSort')}
          description="How the file list is sorted until you change it there."
        >
          {({ labelId }) => (
            <SettingSelect
              labelId={labelId}
              value={sortValue}
              onChange={value =>
                update({
                  defaultSort: sortChoices.find(c => c.value === value)?.sort,
                })
              }
              choices={[
                {
                  value: AUTOMATIC,
                  label: (
                    <span className="text-muted-foreground">
                      Automatic: published date, newest first
                    </span>
                  ),
                },
                ...sortChoices,
              ]}
            />
          )}
        </Setting>
      </SettingsSection>

      <SettingsSection title="Frontmatter Fields">
        <Setting
          label="Title"
          source={resolved.titleField.source}
          onReset={reset('titleField')}
          missing="No string `title` field, so files are listed by their file name."
        >
          {({ labelId }) =>
            fieldSelect('titleField', FieldType.String, labelId)
          }
        </Setting>

        <Setting
          label="Description"
          source={resolved.descriptionField.source}
          onReset={reset('descriptionField')}
          missing="No string `description` field, so no field gets the larger text box."
        >
          {({ labelId }) =>
            fieldSelect('descriptionField', FieldType.String, labelId)
          }
        </Setting>

        <Setting
          label="Published Date"
          source={resolved.publishedDateField.source}
          onReset={reset('publishedDateField')}
          missing="No date field named `pubDate`, `date` or `publishedDate`, so files aren't dated or sorted by date."
        >
          {({ labelId }) =>
            fieldSelect('publishedDateField', FieldType.Date, labelId)
          }
        </Setting>

        <Setting
          label="Draft"
          source={resolved.draftField.source}
          onReset={reset('draftField')}
          missing="No boolean `draft` field, so there's no draft badge or filter for this collection."
        >
          {({ labelId }) =>
            fieldSelect('draftField', FieldType.Boolean, labelId)
          }
        </Setting>
      </SettingsSection>

      <SettingsSection title="Images">
        <Setting
          label="Assets Folder"
          source={resolved.assetsDirectory.source}
          onReset={reset('assetsDirectory')}
          description={
            <WithCode
              text={`Images you add are copied to \`${resolved.assetsDirectory.value}/${collection.name}/\`.`}
            />
          }
        >
          {({ id }) => (
            <FolderInput
              id={id}
              value={stored.assetsDirectory ?? ''}
              placeholder={resolved.assetsDirectory.value}
              start={`${projectPath}/${resolved.assetsDirectory.value}`}
              onChange={value => update({ assetsDirectory: value })}
            />
          )}
        </Setting>

        <Setting
          label="Use Absolute Paths for Images"
          source={resolved.useAbsoluteAssetPaths.source}
          onReset={reset('useAbsoluteAssetPaths')}
          inline
          description={
            <WithCode text="Write image paths from the project root (`/src/assets/image.png`) rather than relative to the file (`../../assets/image.png`)." />
          }
        >
          {({ id }) => (
            <Switch
              id={id}
              checked={resolved.useAbsoluteAssetPaths.value}
              onCheckedChange={checked =>
                update({ useAbsoluteAssetPaths: checked })
              }
            />
          )}
        </Setting>
      </SettingsSection>

      <SettingsSection title="Content Links">
        <Setting
          label="Link URL Pattern"
          source={resolved.urlPattern.source}
          onReset={reset('urlPattern')}
          description={
            <>
              <WithCode text="A template for links to this collection's entries, with `{slug}` for the entry, like `/blog/{slug}`." />{' '}
              <DocsLink href={DOCS_URLS.overrides}>Learn more</DocsLink>
            </>
          }
        >
          {({ id }) => (
            <PreferencesTextInput
              id={id}
              value={stored.urlPattern ?? ''}
              placeholder="None: links use the file's relative path"
              onCommit={value => update({ urlPattern: value })}
            />
          )}
        </Setting>
      </SettingsSection>

      <SettingsSection title="Schema">
        <SchemaFields collection={collection} schema={schema} />
      </SettingsSection>
    </div>
  )
}
