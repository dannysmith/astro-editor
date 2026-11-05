import React from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { usePreferences } from '../../../hooks/usePreferences'
import { SettingsSection } from '../SettingsSection'
import { PreferencesTextInput } from '../PreferencesTextInput'
import { DocsLink } from '../DocsLink'
import { DOCS_URLS } from '../../../lib/docs-urls'
import { useProjectDependenciesQuery } from '../../../hooks/queries/useProjectDependenciesQuery'

export const ProjectSettingsPane: React.FC = () => {
  const { projectSettings, updateProject, projectName, projectPath } =
    usePreferences()
  const settings = projectSettings?.project
  const { data: dependencies = [] } = useProjectDependenciesQuery(projectPath)
  const usesAutoImport = dependencies.includes('astro-auto-import')
  const absolutePathsId = React.useId()
  const addImportsId = React.useId()
  const contentDirId = React.useId()
  const assetsDirId = React.useId()
  const mdxDirId = React.useId()

  const handlePathOverrideChange = (
    key: 'contentDirectory' | 'assetsDirectory' | 'mdxComponentsDirectory',
    value: string
  ) => {
    void updateProject({ [key]: value || undefined })
  }

  // Off is the default, so it's stored as unset
  const handleAbsolutePathsChange = (checked: boolean) => {
    void updateProject({ useAbsoluteAssetPaths: checked || undefined })
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 rounded-lg border bg-muted/50 p-4">
        <h2 className="mb-1 text-base font-semibold text-heading">
          Project Settings
          {projectName && (
            <span className="ml-2 font-normal text-muted-foreground">
              · {projectName}
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          These settings apply to this project only. If not set, default values
          are used. Collections can override the image settings in the
          Collections tab.
        </p>
      </div>

      <SettingsSection title="Path Overrides">
        <p className="-mt-3 mb-2 text-sm text-muted-foreground">
          Override default Astro paths for{' '}
          <span className="font-medium">{projectName}</span>. Paths should be
          relative to the project root.{' '}
          <DocsLink href={DOCS_URLS.overrides}>Learn more</DocsLink>
        </p>

        <Field>
          <FieldLabel htmlFor={contentDirId}>Content Directory</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              id={contentDirId}
              value={settings?.contentDirectory ?? ''}
              onCommit={value =>
                handlePathOverrideChange('contentDirectory', value)
              }
              placeholder="src/content/"
            />
            <FieldDescription>
              Where collections are looked for when their loader doesn't say,
              and whose folders become collections when there's no content
              config (default: src/content/)
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor={assetsDirId}>Assets Directory</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              id={assetsDirId}
              value={settings?.assetsDirectory ?? ''}
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
          <FieldLabel htmlFor={mdxDirId}>MDX Components Directory</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              id={mdxDirId}
              value={settings?.mdxComponentsDirectory ?? ''}
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
              <FieldLabel htmlFor={absolutePathsId}>
                Use Absolute Paths for Images
              </FieldLabel>
              <FieldDescription>
                By default, images use paths relative to the current file (e.g.,{' '}
                <code className="text-xs">../../assets/image.png</code>),
                matching Astro's conventions. Enable this to override and use
                absolute paths from project root instead (e.g.,{' '}
                <code className="text-xs">/src/assets/image.png</code>).
              </FieldDescription>
            </div>
            <Switch
              id={absolutePathsId}
              checked={settings?.useAbsoluteAssetPaths ?? false}
              onCheckedChange={handleAbsolutePathsChange}
            />
          </div>
        </Field>
      </SettingsSection>

      <SettingsSection title="Experimental">
        <Field>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <FieldLabel htmlFor={addImportsId}>
                Add Imports for MDX Components
              </FieldLabel>
              <FieldDescription>
                When you insert a component, also add its{' '}
                <code className="text-xs">import</code> to the file. Leave this
                off if your site imports components automatically.{' '}
                <DocsLink href={DOCS_URLS.mdxComponents}>Learn more</DocsLink>
              </FieldDescription>
              {usesAutoImport && (
                <FieldDescription className="mt-1 text-foreground">
                  This project uses astro-auto-import. If it imports your MDX
                  components, leave this off, or they'll be imported twice and
                  the build will fail.
                </FieldDescription>
              )}
            </div>
            <Switch
              id={addImportsId}
              checked={settings?.addComponentImports ?? false}
              onCheckedChange={checked =>
                void updateProject({
                  addComponentImports: checked || undefined,
                })
              }
            />
          </div>
        </Field>
      </SettingsSection>
    </div>
  )
}
