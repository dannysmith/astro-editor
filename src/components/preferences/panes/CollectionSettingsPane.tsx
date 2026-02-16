import React, { useMemo, useState } from 'react'
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
import { useCollectionsQuery } from '../../../hooks/queries/useCollectionsQuery'
import { getCollectionSettings } from '../../../lib/project-registry/collection-settings'
import { deserializeCompleteSchema, FieldType } from '../../../lib/schema'
import { getDefaultFileType } from '../../../lib/project-registry/default-file-type'
import type { SchemaField } from '../../../lib/schema'
import type { CollectionSettings } from '../../../lib/project-registry/types'
import { SettingsSection } from '../SettingsSection'
import { PreferencesTextInput } from '../PreferencesTextInput'

export const CollectionSettingsPane: React.FC = () => {
  const {
    currentProjectSettings,
    updateCollectionSettings,
    projectPath,
    projectName,
    globalSettings,
  } = usePreferences()

  // Get collections from TanStack Query
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  // Track which collections are expanded
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  )

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
      if (collection.complete_schema) {
        try {
          const schema = deserializeCompleteSchema(collection.complete_schema)
          if (schema) {
            fieldsMap.set(collection.name, schema.fields)
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to parse schema for ${collection.name}:`, error)
        }
      }
    })

    return fieldsMap
  }, [collections])

  // Get effective settings for a collection (including inherited values)
  const getEffectiveSettings = (collectionName: string) => {
    if (!currentProjectSettings) {
      return null
    }
    return getCollectionSettings(currentProjectSettings, collectionName)
  }

  // Get collection-specific override (not inherited)
  const getCollectionOverride = (
    collectionName: string
  ): CollectionSettings | undefined => {
    return currentProjectSettings?.collections?.find(
      c => c.name === collectionName
    )
  }

  // Update a collection's path override
  const handlePathOverrideChange = (
    collectionName: string,
    key: 'contentDirectory' | 'assetsDirectory',
    value: string
  ) => {
    const existing = getCollectionOverride(collectionName)
    const newSettings: CollectionSettings = {
      name: collectionName,
      settings: {
        ...existing?.settings,
        pathOverrides: {
          ...existing?.settings?.pathOverrides,
          [key]: value || undefined, // Remove empty strings
        },
      },
    }

    void updateCollectionSettings(collectionName, newSettings.settings)
  }

  // Update a collection's frontmatter mapping
  const handleFrontmatterMappingChange = (
    collectionName: string,
    key: 'publishedDate' | 'title' | 'description' | 'draft',
    value: string
  ) => {
    const existing = getCollectionOverride(collectionName)
    const newSettings: CollectionSettings = {
      name: collectionName,
      settings: {
        ...existing?.settings,
        frontmatterMappings: {
          ...existing?.settings?.frontmatterMappings,
          [key]: value || undefined, // Remove empty strings
        },
      },
    }

    void updateCollectionSettings(collectionName, newSettings.settings)
  }

  // Reset all overrides for a collection
  const handleResetCollection = (collectionName: string) => {
    void updateCollectionSettings(collectionName, {})
  }

  // Update a collection's default file type
  const handleDefaultFileTypeChange = (
    collectionName: string,
    value: 'md' | 'mdx' | undefined
  ) => {
    const existing = getCollectionOverride(collectionName)
    const newSettings: CollectionSettings = {
      name: collectionName,
      settings: {
        ...existing?.settings,
        defaultFileType: value,
      },
    }
    void updateCollectionSettings(collectionName, newSettings.settings)
  }

  // Update a collection's URL pattern
  const handleUrlPatternChange = (collectionName: string, value: string) => {
    const existing = getCollectionOverride(collectionName)
    const newSettings: CollectionSettings = {
      name: collectionName,
      settings: {
        ...existing?.settings,
        urlPattern: value || undefined, // Remove empty strings
      },
    }
    void updateCollectionSettings(collectionName, newSettings.settings)
  }

  // Update a collection's absolute paths setting
  const handleAbsolutePathsChange = (
    collectionName: string,
    checked: boolean
  ) => {
    const existing = getCollectionOverride(collectionName)
    const newSettings: CollectionSettings = {
      name: collectionName,
      settings: {
        ...existing?.settings,
        useAbsoluteAssetPaths: checked,
      },
    }
    void updateCollectionSettings(collectionName, newSettings.settings)
  }

  // Filter fields by type for a specific collection
  const getFieldsByType = (
    collectionName: string,
    fieldType: FieldType
  ): SchemaField[] => {
    const fields = collectionFields.get(collectionName) || []
    return fields.filter(field => field.type === fieldType)
  }

  // Render a field select dropdown
  const renderFieldSelect = (
    collectionName: string,
    value: string | string[] | undefined,
    onChange: (value: string) => void,
    fieldType: FieldType,
    placeholder: string,
    inheritedValue: string | string[]
  ) => {
    const fields = getFieldsByType(collectionName, fieldType)
    const currentValue = value || 'inherited'
    const displayValue =
      typeof currentValue === 'string' ? currentValue : 'inherited'

    // Format inherited value for display
    const formatInheritedValue = (val: string | string[]): string => {
      if (Array.isArray(val)) {
        return val.join(', ')
      }
      return val
    }

    return (
      <Select
        value={displayValue}
        onValueChange={val => onChange(val === 'inherited' ? '' : val)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inherited">
            <span className="text-muted-foreground">
              Use default: {formatInheritedValue(inheritedValue)}
            </span>
          </SelectItem>
          {fields.map(field => (
            <SelectItem key={field.name} value={field.name}>
              {field.name}
              {!field.required && (
                <span className="text-muted-foreground ml-1">(optional)</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/50 p-4 mb-6">
          <h2 className="text-base font-semibold mb-1 text-heading">
            Collection Settings
            {projectName && (
              <span className="text-muted-foreground font-normal ml-2">
                · {projectName}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure collection-specific overrides for frontmatter mappings and
            paths. These settings override project-level defaults.
          </p>
        </div>

        <div className="text-sm text-muted-foreground p-4 border rounded-lg">
          No collections found. Collection settings will appear when a project
          with collections is loaded.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4 mb-6">
        <h2 className="text-base font-semibold mb-1 text-heading">
          Collection Settings
          {projectName && (
            <span className="text-muted-foreground font-normal ml-2">
              · {projectName}
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Configure collection-specific overrides for frontmatter mappings and
          paths. These settings override project-level defaults.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Fallback chain:</strong> Collection override → Project setting
          → Default value
        </p>
      </div>

      <div className="space-y-4">
        {collections.map(collection => {
          const isExpanded = expandedCollections.has(collection.name)
          const effectiveSettings = getEffectiveSettings(collection.name)
          const collectionOverride = getCollectionOverride(collection.name)
          const hasOverrides =
            !!collectionOverride?.settings?.pathOverrides ||
            !!collectionOverride?.settings?.frontmatterMappings ||
            !!collectionOverride?.settings?.defaultFileType ||
            collectionOverride?.settings?.useAbsoluteAssetPaths !== undefined ||
            !!collectionOverride?.settings?.urlPattern

          if (!effectiveSettings) return null

          return (
            <Collapsible
              key={collection.name}
              open={isExpanded}
              onOpenChange={() => toggleCollection(collection.name)}
            >
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                    )}
                    <span className="font-medium text-heading">
                      {collection.name}
                    </span>
                    {hasOverrides && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-4 pt-0 space-y-6">
                    {/* Path Overrides Section */}
                    <SettingsSection title="Path Overrides">
                      <Field>
                        <FieldLabel>Content Directory</FieldLabel>
                        <FieldContent>
                          <PreferencesTextInput
                            value={
                              collectionOverride?.settings?.pathOverrides
                                ?.contentDirectory || ''
                            }
                            onCommit={value =>
                              handlePathOverrideChange(
                                collection.name,
                                'contentDirectory',
                                value
                              )
                            }
                            placeholder={`Using project setting: ${effectiveSettings.pathOverrides.contentDirectory}`}
                          />
                          <FieldDescription>
                            Collection-specific content directory. Leave empty
                            to use project setting.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel>Assets Directory</FieldLabel>
                        <FieldContent>
                          <PreferencesTextInput
                            value={
                              collectionOverride?.settings?.pathOverrides
                                ?.assetsDirectory || ''
                            }
                            onCommit={value =>
                              handlePathOverrideChange(
                                collection.name,
                                'assetsDirectory',
                                value
                              )
                            }
                            placeholder={`Using project setting: ${effectiveSettings.pathOverrides.assetsDirectory}`}
                          />
                          <FieldDescription>
                            Collection-specific assets directory. Leave empty to
                            use project setting.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <FieldLabel>
                              Use Absolute Paths for Images
                            </FieldLabel>
                            <FieldDescription>
                              Override to use absolute paths from project root
                              (e.g.,{' '}
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
                            checked={
                              collectionOverride?.settings
                                ?.useAbsoluteAssetPaths ?? false
                            }
                            onCheckedChange={checked =>
                              handleAbsolutePathsChange(
                                collection.name,
                                checked
                              )
                            }
                          />
                        </div>
                      </Field>
                    </SettingsSection>

                    {/* File Defaults Section */}
                    <SettingsSection title="File Defaults">
                      <Field>
                        <FieldLabel>Default File Type for New Files</FieldLabel>
                        <FieldContent>
                          <Select
                            value={
                              collectionOverride?.settings?.defaultFileType ||
                              'inherited'
                            }
                            onValueChange={value => {
                              handleDefaultFileTypeChange(
                                collection.name,
                                value === 'inherited'
                                  ? undefined
                                  : (value as 'md' | 'mdx')
                              )
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherited">
                                <span className="text-muted-foreground">
                                  Use default:{' '}
                                  {getDefaultFileType(
                                    globalSettings,
                                    currentProjectSettings,
                                    undefined
                                  ) === 'mdx'
                                    ? 'MDX'
                                    : 'Markdown'}
                                </span>
                              </SelectItem>
                              <SelectItem value="md">Markdown (.md)</SelectItem>
                              <SelectItem value="mdx">MDX (.mdx)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldDescription>
                            File type used when creating new files in this
                            collection
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </SettingsSection>

                    {/* Frontmatter Mappings Section */}
                    <SettingsSection title="Frontmatter Mappings">
                      <Field>
                        <FieldLabel>Published Date Field</FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection.name,
                            collectionOverride?.settings?.frontmatterMappings
                              ?.publishedDate,
                            value =>
                              handleFrontmatterMappingChange(
                                collection.name,
                                'publishedDate',
                                value
                              ),
                            FieldType.Date,
                            'Select date field',
                            effectiveSettings.frontmatterMappings.publishedDate
                          )}
                          <FieldDescription>
                            Field used for ordering files in the list
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel>Title Field</FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection.name,
                            collectionOverride?.settings?.frontmatterMappings
                              ?.title,
                            value =>
                              handleFrontmatterMappingChange(
                                collection.name,
                                'title',
                                value
                              ),
                            FieldType.String,
                            'Select text field',
                            effectiveSettings.frontmatterMappings.title
                          )}
                          <FieldDescription>
                            Field that gets special treatment in the frontmatter
                            panel
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel>Description Field</FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection.name,
                            collectionOverride?.settings?.frontmatterMappings
                              ?.description,
                            value =>
                              handleFrontmatterMappingChange(
                                collection.name,
                                'description',
                                value
                              ),
                            FieldType.String,
                            'Select text field',
                            effectiveSettings.frontmatterMappings.description
                          )}
                          <FieldDescription>
                            Field that gets special treatment in the frontmatter
                            panel
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel>Draft Field</FieldLabel>
                        <FieldContent>
                          {renderFieldSelect(
                            collection.name,
                            collectionOverride?.settings?.frontmatterMappings
                              ?.draft,
                            value =>
                              handleFrontmatterMappingChange(
                                collection.name,
                                'draft',
                                value
                              ),
                            FieldType.Boolean,
                            'Select boolean field',
                            effectiveSettings.frontmatterMappings.draft
                          )}
                          <FieldDescription>
                            Field that shows a draft marker in the file list
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    </SettingsSection>

                    {/* Link URL Pattern Section */}
                    <SettingsSection title="Content Links">
                      <Field>
                        <FieldLabel>Link URL Pattern</FieldLabel>
                        <FieldContent>
                          <PreferencesTextInput
                            value={
                              collectionOverride?.settings?.urlPattern || ''
                            }
                            onCommit={value =>
                              handleUrlPatternChange(collection.name, value)
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

                    {/* Reset Button */}
                    {hasOverrides && (
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetCollection(collection.name)}
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
