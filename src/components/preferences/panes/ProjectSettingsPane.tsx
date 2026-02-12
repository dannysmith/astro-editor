import React from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePreferences } from '../../../hooks/usePreferences'
import { SettingsSection } from '../SettingsSection'
import { PreferencesTextInput } from '../PreferencesTextInput'

export const ProjectSettingsPane: React.FC = () => {
  const { currentProjectSettings, updateProject, projectName, globalSettings } =
    usePreferences()

  const handlePathOverrideChange = (
    key: 'contentDirectory' | 'assetsDirectory' | 'mdxComponentsDirectory',
    value: string
  ) => {
    void updateProject({
      pathOverrides: {
        ...currentProjectSettings?.pathOverrides,
        [key]: value || undefined, // Remove empty strings
      },
    })
  }

  const handleDefaultFileTypeChange = (value: string) => {
    void updateProject({
      ...currentProjectSettings,
      defaultFileType:
        value === 'inherited' ? undefined : (value as 'md' | 'mdx'),
    })
  }

  const handleAbsolutePathsChange = (checked: boolean) => {
    void updateProject({
      useAbsoluteAssetPaths: checked,
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4 mb-6">
        <h2 className="text-base font-semibold mb-1 text-heading">
          Project Settings
          {projectName && (
            <span className="text-muted-foreground font-normal ml-2">
              · {projectName}
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          These settings apply to this project only. If not set, default values
          are used. Collection-specific overrides can be configured in the
          Collections tab.
        </p>
      </div>

      <SettingsSection title="Path Overrides">
        <p className="text-sm text-muted-foreground -mt-3 mb-2">
          Override default Astro paths for{' '}
          <span className="font-medium">{projectName}</span>. Paths should be
          relative to the project root.
        </p>

        <Field>
          <FieldLabel>Content Directory</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              value={
                currentProjectSettings?.pathOverrides?.contentDirectory || ''
              }
              onCommit={value =>
                handlePathOverrideChange('contentDirectory', value)
              }
              placeholder="src/content/"
            />
            <FieldDescription>
              Path to Astro content directory (default: src/content/)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Assets Directory</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              value={
                currentProjectSettings?.pathOverrides?.assetsDirectory || ''
              }
              onCommit={value =>
                handlePathOverrideChange('assetsDirectory', value)
              }
              placeholder="src/assets/"
            />
            <FieldDescription>
              Path to Astro assets directory (default: src/assets/)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>MDX Components Directory</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              value={
                currentProjectSettings?.pathOverrides?.mdxComponentsDirectory ||
                ''
              }
              onCommit={value =>
                handlePathOverrideChange('mdxComponentsDirectory', value)
              }
              placeholder="src/components/mdx/"
            />
            <FieldDescription>
              Path to components for use in MDX files (default:
              src/components/mdx/)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <FieldLabel>Use Absolute Paths for Images</FieldLabel>
              <FieldDescription>
                By default, images use paths relative to the current file (e.g.,{' '}
                <code className="text-xs">../../assets/image.png</code>),
                matching Astro's conventions. Enable this to override and use
                absolute paths from project root instead (e.g.,{' '}
                <code className="text-xs">/src/assets/image.png</code>).
              </FieldDescription>
            </div>
            <Switch
              checked={currentProjectSettings?.useAbsoluteAssetPaths ?? false}
              onCheckedChange={handleAbsolutePathsChange}
            />
          </div>
        </Field>
      </SettingsSection>

      <SettingsSection title="File Defaults">
        <Field>
          <FieldLabel>Default File Type for New Files</FieldLabel>
          <FieldContent>
            <Select
              value={currentProjectSettings?.defaultFileType || 'inherited'}
              onValueChange={handleDefaultFileTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherited">
                  <span className="text-muted-foreground">
                    Use global default:{' '}
                    {globalSettings?.general?.defaultFileType === 'mdx'
                      ? 'MDX'
                      : 'Markdown'}
                  </span>
                </SelectItem>
                <SelectItem value="md">Markdown (.md)</SelectItem>
                <SelectItem value="mdx">MDX (.mdx)</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              File type used when creating new files in this project
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>
    </div>
  )
}
