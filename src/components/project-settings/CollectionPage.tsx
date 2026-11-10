import { Files } from 'lucide-react'
import type {
  Collection,
  CollectionSettings,
  FileType,
  ProjectScan,
  Resolved,
} from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePreferences } from '../../hooks/usePreferences'
import { DOCS_URLS } from '../../lib/docs-urls'
import { getSortOptionsForCollection } from '../../lib/files/sorting'
import { FieldType, type CompleteSchema } from '../../lib/schema'
import { useCollectionFilesQuery } from '../../hooks/queries/useCollectionFilesQuery'
import {
  defaultSortChoices,
  describeOrigin,
  exampleImagePath,
  frontmatterKeysOfType,
} from '../../lib/project-settings/describe'
import { chooseProjectFolder } from '../../lib/project-settings/actions'
import {
  collectionProblems,
  relativePath,
} from '../../lib/project-settings/status'
import { PreferencesTextInput } from '../preferences/PreferencesTextInput'
import { DocsLink } from '../preferences/DocsLink'
import { NoteCallout, ProblemCallout, WithCode } from './Problems'
import {
  FolderInput,
  FoundValue,
  PageHeader,
  PageIcon,
  Setting,
  SettingSelect,
  SettingsGroup,
} from './Setting'
import { SchemaFields } from './SchemaFields'
import { FileNamePatternInput } from './FileNamePatternInput'

type FieldSetting =
  | 'titleField'
  | 'descriptionField'
  | 'publishedDateField'
  | 'draftField'

/** The first choice of a dropdown: unset, so AE decides */
const AUTOMATIC = 'automatic'

const FILE_TYPES: Record<FileType, string> = { md: 'Markdown', mdx: 'MDX' }

const IMAGE_PATHS = {
  relative: 'Relative to the file',
  absolute: 'From the project root',
}

/**
 * A collection of Markdown files: where it comes from and anything wrong,
 * its settings, and its schema's fields
 */
export function CollectionPage({
  collection,
  schema,
  scan,
  projectPath,
}: {
  collection: Collection
  schema: CompleteSchema | null
  scan: ProjectScan
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
  const chooseFolder = () =>
    void chooseProjectFolder(projectPath).then(chosen => {
      if (chosen) update({ folder: chosen })
    })

  // Without a generated schema, field mappings offer the keys the files have
  const schemaComplete = collection.schemaStatus === 'complete'
  const filesQuery = useCollectionFilesQuery(
    projectPath,
    schemaComplete ? undefined : collection
  )
  const files = filesQuery.data ?? []

  /**
   * A dropdown of the fields of a type, for a field mapping: the schema's, or
   * without a generated schema, the keys the files have
   */
  const fieldSelect = (
    key: FieldSetting,
    type: FieldType.String | FieldType.Date | FieldType.Boolean,
    labelId: string
  ) => {
    const value: Resolved<string | string[] | null> = resolved[key]
    const schemaFields = (schema?.fields ?? []).filter(f => f.type === type)
    const optional = new Set(
      schemaFields.filter(f => !f.required).map(f => f.name)
    )
    const fileKeys = schemaComplete ? [] : frontmatterKeysOfType(files, type)
    // The stored field too, in case it's no longer offered
    const names = new Set([
      ...schemaFields.map(f => f.name),
      ...fileKeys,
      ...(stored[key] ? [stored[key]] : []),
    ])
    const none = <span className="text-muted-foreground">None</span>
    // Without a generated schema, the usual names (`title`; `pubDate`, `date`
    // or `publishedDate`) are read from the files, so say which they use
    const inFiles = [value.value].flat().find(name => fileKeys.includes(name!))
    const automatic =
      value.source === 'schema' ? (
        <FoundValue source="Detected" value={[value.value].flat().join(', ')} />
      ) : value.source === 'convention' && filesQuery.isSuccess ? (
        inFiles ? (
          <FoundValue source="Found in files" value={inFiles} />
        ) : (
          none
        )
      ) : value.source === 'missing' ? (
        none
      ) : (
        <span className="text-muted-foreground">Automatic</span>
      )
    return (
      <SettingSelect
        labelId={labelId}
        value={stored[key] ?? AUTOMATIC}
        onChange={next =>
          update({ [key]: next === AUTOMATIC ? undefined : next })
        }
        choices={[
          { value: AUTOMATIC, label: automatic },
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

  const globalFileType = globalSettings?.general.defaultFileType ?? 'md'
  const projectAbsolute = scan.projectSettings.useAbsoluteAssetPaths.value
  const imagePaths =
    stored.useAbsoluteAssetPaths === undefined
      ? AUTOMATIC
      : stored.useAbsoluteAssetPaths
        ? 'absolute'
        : 'relative'
  const assets = resolved.assetsDirectory

  return (
    <div className="space-y-6">
      <PageHeader icon={<PageIcon icon={Files} />} title={collection.name}>
        <WithCode text={describeOrigin(collection, scan)} />
      </PageHeader>

      {collectionProblems(collection, projectPath).map(problem => (
        <ProblemCallout
          key={problem.message}
          problem={problem}
          action={
            problem.action === 'chooseFolder' && (
              <Button size="sm" onClick={chooseFolder}>
                Choose Folder…
              </Button>
            )
          }
        />
      ))}

      {collection.schemaStatus === 'none' && (
        <NoteCallout
          message="It has no schema, so the form shows each file's own fields as text, without types, defaults or required markers."
          fix={
            scan.configPath && collection.kind !== 'folder'
              ? `To get them, give it a \`schema\` in \`${scan.configPath}\`.`
              : undefined
          }
        />
      )}

      <SettingsGroup title="Files">
        <Setting
          label="Folder"
          source={collection.folderSource}
          onReset={reset('folder')}
          resetTo={
            collection.kind === 'glob'
              ? "the content config's folder"
              : `${collection.kind === 'legacy' ? 'src/content' : scan.projectSettings.contentDirectory.value}/${collection.name}`
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
          label="Show files Astro skips"
          help={
            <WithCode text="Such as drafts named `_draft.md`. They're shown dimmed." />
          }
          source={resolved.skippedFiles.source}
          onReset={reset('skippedFiles')}
          resetTo="off"
        >
          {({ id }) => (
            <Switch
              id={id}
              checked={resolved.skippedFiles.value === 'dim'}
              onCheckedChange={checked =>
                update({ skippedFiles: checked ? 'dim' : 'hide' })
              }
            />
          )}
        </Setting>

        <Setting
          label="Sort"
          help="Until you change it in the file list."
          source={resolved.defaultSort.source}
          onReset={reset('defaultSort')}
          resetTo="newest first"
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
                  label: <FoundValue source="Default" value="newest first" />,
                },
                ...sortChoices,
              ]}
            />
          )}
        </Setting>
      </SettingsGroup>

      <SettingsGroup title="New Files">
        <Setting
          label="Type"
          help={
            resolved.newFileType.source === 'config' &&
            'The only type its pattern includes.'
          }
          source={resolved.newFileType.source}
          onReset={reset('defaultFileType')}
          resetTo="the global preference"
        >
          {({ labelId }) =>
            resolved.newFileType.source === 'config' ? (
              <span className="text-sm">
                {FILE_TYPES[resolved.newFileType.value]}
              </span>
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
                      <FoundValue
                        source="Global preference"
                        value={FILE_TYPES[globalFileType]}
                      />
                    ),
                  },
                  { value: 'md', label: FILE_TYPES.md },
                  { value: 'mdx', label: FILE_TYPES.mdx },
                ]}
              />
            )
          }
        </Setting>

        <Setting
          label="Name"
          help={
            <DocsLink href={DOCS_URLS.fileNamePatterns}>
              Pattern syntax
            </DocsLink>
          }
          source={resolved.fileNamePattern.source}
          onReset={reset('fileNamePattern')}
          resetTo="{YYYY-MM-DD}"
          wide
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
      </SettingsGroup>

      <SettingsGroup
        title="Frontmatter"
        note={<DocsLink href={DOCS_URLS.specialFields}>Learn more</DocsLink>}
      >
        <Setting
          label="Title"
          help="Names files in the file list, and heads the form."
          source={resolved.titleField.source}
          onReset={reset('titleField')}
          resetTo="automatic"
        >
          {({ labelId }) =>
            fieldSelect('titleField', FieldType.String, labelId)
          }
        </Setting>
        <Setting
          label="Description"
          help="Gets a larger text box in the form."
          source={resolved.descriptionField.source}
          onReset={reset('descriptionField')}
          resetTo="automatic"
        >
          {({ labelId }) =>
            fieldSelect('descriptionField', FieldType.String, labelId)
          }
        </Setting>
        <Setting
          label="Published date"
          help="Dates and sorts the file list."
          source={resolved.publishedDateField.source}
          onReset={reset('publishedDateField')}
          resetTo="automatic"
        >
          {({ labelId }) =>
            fieldSelect('publishedDateField', FieldType.Date, labelId)
          }
        </Setting>
        <Setting
          label="Draft"
          help="Shows a Draft badge, and lets you filter drafts."
          source={resolved.draftField.source}
          onReset={reset('draftField')}
          resetTo="automatic"
        >
          {({ labelId }) =>
            fieldSelect('draftField', FieldType.Boolean, labelId)
          }
        </Setting>
      </SettingsGroup>

      <SettingsGroup title="Images and Links">
        <Setting
          label="Image folder"
          help={
            <WithCode
              text={`${assets.source === 'project' ? "The project's folder. " : ''}Images go in \`${assets.value}/${collection.name}\`.`}
            />
          }
          source={assets.source}
          onReset={reset('assetsDirectory')}
          resetTo={scan.projectSettings.assetsDirectory.value}
        >
          {({ id }) => (
            <FolderInput
              id={id}
              value={stored.assetsDirectory ?? ''}
              placeholder={assets.value}
              start={`${projectPath}/${assets.value}`}
              onChange={value => update({ assetsDirectory: value })}
            />
          )}
        </Setting>

        <Setting
          label="Image paths"
          help={
            <WithCode
              text={`Like \`${exampleImagePath(folder, assets.value, collection.name, resolved.useAbsoluteAssetPaths.value)}\``}
            />
          }
          source={resolved.useAbsoluteAssetPaths.source}
          onReset={reset('useAbsoluteAssetPaths')}
          resetTo="the project's setting"
        >
          {({ labelId }) => (
            <SettingSelect
              labelId={labelId}
              value={imagePaths}
              onChange={value =>
                update({
                  useAbsoluteAssetPaths:
                    value === AUTOMATIC ? undefined : value === 'absolute',
                })
              }
              choices={[
                {
                  value: AUTOMATIC,
                  label: (
                    <FoundValue
                      source="Project setting"
                      value={
                        projectAbsolute
                          ? IMAGE_PATHS.absolute
                          : IMAGE_PATHS.relative
                      }
                    />
                  ),
                },
                { value: 'relative', label: IMAGE_PATHS.relative },
                { value: 'absolute', label: IMAGE_PATHS.absolute },
              ]}
            />
          )}
        </Setting>

        <Setting
          label="Link URLs"
          help={
            <WithCode text="For links you insert with the Content Finder. `{slug}` is the entry's slug." />
          }
          source={resolved.urlPattern.source}
          onReset={reset('urlPattern')}
          resetTo="none"
        >
          {({ id }) => (
            <PreferencesTextInput
              id={id}
              value={stored.urlPattern ?? ''}
              placeholder="None"
              onCommit={value => update({ urlPattern: value })}
              className="font-mono text-xs"
            />
          )}
        </Setting>
      </SettingsGroup>

      <SchemaFields collection={collection} schema={schema} />
    </div>
  )
}
