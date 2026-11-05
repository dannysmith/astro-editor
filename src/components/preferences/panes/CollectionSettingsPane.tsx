import React, { useMemo, useState } from 'react'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { usePreferences } from '../../../hooks/usePreferences'
import { useProjectScanQuery } from '../../../hooks/queries/useCollectionsQuery'
import { deserializeCompleteSchema, FieldType } from '../../../lib/schema'
import type { SchemaField } from '../../../lib/schema'
import type { Collection, CollectionSettings, FileType } from '@/lib/bindings'
import { SettingsSection } from '../SettingsSection'
import { PreferencesTextInput } from '../PreferencesTextInput'
import { DocsLink } from '../DocsLink'
import { DOCS_URLS } from '../../../lib/docs-urls'

type FieldSetting =
  | 'publishedDateField'
  | 'titleField'
  | 'descriptionField'
  | 'draftField'

/** A path relative to the project, for showing */
function relativePath(path: string, projectPath: string | null): string {
  return projectPath && path.startsWith(`${projectPath}/`)
    ? path.slice(projectPath.length + 1)
    : path
}

export const CollectionSettingsPane: React.FC = () => {
  const {
    projectSettings,
    updateCollectionSettings,
    projectPath,
    projectName,
    globalSettings,
  } = usePreferences()

  // Every collection with content, including ones whose folder is missing,
  // so their folder can be set here
  const { data: scan } = useProjectScanQuery(projectPath)
  const collections = (scan?.collections ?? []).filter(c => c.kind !== 'data')

  // Track which collections are expanded
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  )

  // Ids that tie each label to its control. Inputs use htmlFor; select
  // triggers are buttons, which htmlFor would click, so they name themselves
  // with aria-labelledby
  const id = React.useId()

  const toggleCollection = (collectionName: string) => {
    const newExpanded = new Set(expandedCollections)
    if (newExpanded.has(collectionName)) {
      newExpanded.delete(collectionName)
    } else {
      newExpanded.add(collectionName)
    }
    setExpandedCollections(newExpanded)
  }

  // Get all schema fields from all collections
  const collectionFields = useMemo(() => {
    const fieldsMap = new Map<string, SchemaField[]>()

    collections.forEach(collection => {
      if (collection.completeSchema) {
        try {
          const schema = deserializeCompleteSchema(collection.completeSchema)
          if (schema) {
            fieldsMap.set(collection.name, schema.fields)
          }
        } catch (error) {
          void logWarn(
            `Failed to parse schema for ${collection.name}: ${String(error)}`
          )
        }
      }
    })

    return fieldsMap
  }, [collections])

  /** Changes a collection's settings; `undefined` or `''` unsets one */
  const update = (collectionName: string, settings: CollectionSettings) => {
    void updateCollectionSettings(collectionName, settings)
  }

  // Render a field select dropdown
  const renderFieldSelect = (
    collection: Collection,
    key: FieldSetting,
    fieldType: FieldType,
    labelId: string
  ) => {
    const fields = (collectionFields.get(collection.name) || []).filter(
      field => field.type === fieldType
    )
    const stored = projectSettings?.collections[collection.name]?.[key]
    const resolved = collection.settings[key]
    const resolvedName = Array.isArray(resolved.value)
      ? resolved.value.join(', ')
      : resolved.value

    const items = [
      {
        value: 'inherited',
        label: (
          <span className="text-muted-foreground">
            {resolved.source === 'set'
              ? 'Detect automatically'
              : `Detected: ${resolvedName || 'none found'}`}
          </span>
        ),
      },
      ...fields.map(field => ({
        value: field.name,
        label: (
          <>
            {field.name}
            {!field.required && (
              <span className="ml-1 text-muted-foreground">(optional)</span>
            )}
          </>
        ),
      })),
    ]

    return (
      <Select
        items={items}
        value={stored || 'inherited'}
        onValueChange={val => {
          if (val) {
            update(collection.name, {
              [key]: val === 'inherited' ? undefined : val,
            })
          }
        }}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mb-6 rounded-lg border bg-muted/50 p-4">
          <h2 className="mb-1 text-base font-semibold text-heading">
            Collection Settings
            {projectName && (
              <span className="ml-2 font-normal text-muted-foreground">
                · {projectName}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure how Astro Editor reads each collection.
          </p>
        </div>

        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          No collections found. Collection settings will appear when a project
          with collections is loaded.
        </div>
      </div>
    )
  }

  const fileTypeItems = [
    {
      value: 'inherited',
      label: (
        <span className="text-muted-foreground">
          Use global default:{' '}
          {globalSettings?.general.defaultFileType === 'mdx'
            ? 'MDX'
            : 'Markdown'}
        </span>
      ),
    },
    { value: 'md', label: 'Markdown (.md)' },
    { value: 'mdx', label: 'MDX (.mdx)' },
  ]

  const skippedFilesItems = [
    { value: 'hide', label: 'Hide them' },
    { value: 'dim', label: 'Show them dimmed' },
  ]

  return (
    <div className="space-y-6">
      <div className="mb-6 rounded-lg border bg-muted/50 p-4">
        <h2 className="mb-1 text-base font-semibold text-heading">
          Collection Settings
          {projectName && (
            <span className="ml-2 font-normal text-muted-foreground">
              · {projectName}
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          Astro Editor reads each collection&apos;s folder from the content
          config and its fields from the schema. Change a setting here only when
          that isn&apos;t right.{' '}
          <DocsLink href={DOCS_URLS.overrides}>Learn more</DocsLink>
        </p>
      </div>

      <div className="space-y-4">
        {collections.map(collection => {
          const isExpanded = expandedCollections.has(collection.name)
          const stored = projectSettings?.collections[collection.name] ?? {}
          const resolved = collection.settings
          const hasOverrides = Object.keys(stored).length > 0
          const fieldId = (key: string) => `${id}-${collection.name}-${key}`

          return (
            <Collapsible
              key={collection.name}
              open={isExpanded}
              onOpenChange={() => toggleCollection(collection.name)}
            >
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4 transition-colors hover:bg-accent/50">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-icon" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-icon" />
                    )}
                    <span className="font-medium text-heading">
                      {collection.name}
                    </span>
                    {hasOverrides && (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Custom
                      </span>
                    )}
                    {collection.folderStatus !== 'ok' && (
                      <span className="text-xs text-muted-foreground">
                        {collection.folderStatus === 'missing'
                          ? 'Folder not found'
                          : 'Folder outside the project'}
                      </span>
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="space-y-6 p-4 pt-0">
                    <SettingsSection title="Files">
                      <Field>
                        <FieldLabel htmlFor={fieldId('folder')}>
                          Folder
                        </FieldLabel>
                        <FieldContent>
                          <PreferencesTextInput
                            id={fieldId('folder')}
                            value={stored.folder ?? ''}
                            onCommit={value =>
                              update(collection.name, { folder: value })
                            }
                            placeholder={relativePath(
                              collection.path,
                              projectPath
                            )}
                          />
                          <FieldDescription>
                            {collection.folderSource === 'config'
                              ? 'Read from the content config. '
                              : ''}
                            Set this only if the collection&apos;s files are
                            somewhere else, relative to the project root.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel id={fieldId('skipped-files')}>
                          Files the Pattern Leaves Out
                        </FieldLabel>
                        <FieldContent>
                          <Select
                            items={skippedFilesItems}
                            value={resolved.skippedFiles.value}
                            onValueChange={value => {
                              if (value) {
                                update(collection.name, {
                                  skippedFiles:
                                    value === 'hide' ? undefined : value,
                                })
                              }
                            }}
                          >
                            <SelectTrigger
                              aria-labelledby={fieldId('skipped-files')}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {skippedFilesItems.map(item => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldDescription>
                            Markdown files in the folder that the
                            collection&apos;s pattern
                            {collection.patterns
                              ? ` (${collection.patterns.join(', ')})`
                              : ''}{' '}
                            leaves out, like drafts named{' '}
                            <code className="text-xs">_draft.md</code>.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel id={fieldId('file-type')}>
                          Default File Type for New Files
                        </FieldLabel>
                        <FieldContent>
                          {resolved.newFileType.source === 'config' ? (
                            <FieldDescription>
                              New files are{' '}
                              <code className="text-xs">
                                .{resolved.newFileType.value}
                              </code>
                              , the only type the collection&apos;s pattern
                              includes.
                            </FieldDescription>
                          ) : (
                            <Select
                              items={fileTypeItems}
                              value={stored.defaultFileType ?? 'inherited'}
                              onValueChange={value => {
                                if (!value) return
                                update(collection.name, {
                                  defaultFileType:
                                    value === 'inherited'
                                      ? undefined
                                      : (value as FileType),
                                })
                              }}
                            >
                              <SelectTrigger
                                aria-labelledby={fieldId('file-type')}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fileTypeItems.map(item => (
                                  <SelectItem
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </FieldContent>
                      </Field>
                    </SettingsSection>

                    <SettingsSection title="Images">
                      <Field>
                        <FieldLabel htmlFor={fieldId('assets')}>
                          Assets Directory
                        </FieldLabel>
                        <FieldContent>
                          <PreferencesTextInput
                            id={fieldId('assets')}
                            value={stored.assetsDirectory ?? ''}
                            onCommit={value =>
                              update(collection.name, {
                                assetsDirectory: value,
                              })
                            }
                            placeholder={resolved.assetsDirectory.value}
                          />
                          <FieldDescription>
                            Where images added to this collection are copied.
                            Leave empty to use the project setting.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <FieldLabel htmlFor={fieldId('absolute-paths')}>
                              Use Absolute Paths for Images
                            </FieldLabel>
                            <FieldDescription>
                              Use absolute paths from project root (e.g.,{' '}
                              <code className="text-xs">
                                /src/assets/image.png
                              </code>
                              ) instead of the default relative paths (e.g.,{' '}
                              <code className="text-xs">
                                ../../assets/image.png
                              </code>
                              ).
                            </FieldDescription>
                          </div>
                          <Switch
                            id={fieldId('absolute-paths')}
                            checked={resolved.useAbsoluteAssetPaths.value}
                            onCheckedChange={checked =>
                              update(collection.name, {
                                useAbsoluteAssetPaths: checked,
                              })
                            }
                          />
                        </div>
                      </Field>
                    </SettingsSection>

                    <SettingsSection title="Frontmatter Mappings">
                      <Field>
                        <FieldLabel id={fieldId('date-field')}>
                          Published Date Field
                        </FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection,
                            'publishedDateField',
                            FieldType.Date,
                            fieldId('date-field')
                          )}
                          <FieldDescription>
                            Field used for ordering files in the list
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel id={fieldId('title-field')}>
                          Title Field
                        </FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection,
                            'titleField',
                            FieldType.String,
                            fieldId('title-field')
                          )}
                          <FieldDescription>
                            Field that gets special treatment in the frontmatter
                            panel
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel id={fieldId('description-field')}>
                          Description Field
                        </FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection,
                            'descriptionField',
                            FieldType.String,
                            fieldId('description-field')
                          )}
                          <FieldDescription>
                            Field that gets special treatment in the frontmatter
                            panel
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel id={fieldId('draft-field')}>
                          Draft Field
                        </FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection,
                            'draftField',
                            FieldType.Boolean,
                            fieldId('draft-field')
                          )}
                          <FieldDescription>
                            Field that shows a draft marker in the file list
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </SettingsSection>

                    <SettingsSection title="Content Links">
                      <Field>
                        <FieldLabel htmlFor={fieldId('url-pattern')}>
                          Link URL Pattern
                        </FieldLabel>
                        <FieldContent>
                          <PreferencesTextInput
                            id={fieldId('url-pattern')}
                            value={stored.urlPattern ?? ''}
                            onCommit={value =>
                              update(collection.name, { urlPattern: value })
                            }
                            placeholder="/path/{slug}"
                          />
                          <FieldDescription>
                            URL template for content links. Use{' '}
                            <code className="text-xs">{'{slug}'}</code> for the
                            content slug. Leave empty for relative file paths.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </SettingsSection>

                    {hasOverrides && (
                      <div className="border-t pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void updateCollectionSettings(
                              collection.name,
                              Object.fromEntries(
                                Object.keys(stored).map(key => [key, undefined])
                              )
                            )
                          }
                        >
                          Reset to Defaults
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )
        })}
      </div>
    </div>
  )
}
