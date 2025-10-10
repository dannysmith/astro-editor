import React from 'react'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { usePreferences } from '../../../hooks/usePreferences'

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <FieldGroup>{children}</FieldGroup>
  </div>
)

export const ProjectSettingsPane: React.FC = () => {
  const { currentProjectSettings, updateProject, projectName } =
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

  return (
    <div className="space-y-6">
      <SettingsSection title="Path Overrides">
        <p className="text-sm text-muted-foreground -mt-3 mb-2">
          Override default Astro paths for{' '}
          <span className="font-medium">{projectName}</span>. Paths should be
          relative to the project root.
        </p>

        <Field>
          <FieldLabel>Content Directory</FieldLabel>
          <FieldContent>
            <Input
              value={
                currentProjectSettings?.pathOverrides?.contentDirectory || ''
              }
              onChange={e =>
                handlePathOverrideChange('contentDirectory', e.target.value)
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
            <Input
              value={
                currentProjectSettings?.pathOverrides?.assetsDirectory || ''
              }
              onChange={e =>
                handlePathOverrideChange('assetsDirectory', e.target.value)
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
            <Input
              value={
                currentProjectSettings?.pathOverrides?.mdxComponentsDirectory ||
                ''
              }
              onChange={e =>
                handlePathOverrideChange(
                  'mdxComponentsDirectory',
                  e.target.value
                )
              }
              placeholder="src/components/mdx/"
            />
            <FieldDescription>
              Path to components for use in MDX files (default:
              src/components/mdx/)
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>
    </div>
  )
}
