import type { ProjectScan, ProjectSettings } from '@/lib/bindings'
import { Switch } from '@/components/ui/switch'
import { usePreferences } from '../../hooks/usePreferences'
import { useProjectDependenciesQuery } from '../../hooks/queries/useProjectDependenciesQuery'
import { DOCS_URLS } from '../../lib/docs-urls'
import { projectProblems } from '../../lib/project-settings/status'
import { SettingsSection } from '../preferences/SettingsSection'
import { DocsLink } from '../preferences/DocsLink'
import { ProblemList, WithCode } from './Problems'
import { FolderInput, Setting } from './Setting'

/** How AE has read the project, and the settings for the whole project */
export function ProjectPage({
  scan,
  projectPath,
}: {
  scan: ProjectScan
  projectPath: string
}) {
  const { projectSettings, updateProject } = usePreferences()
  const stored = projectSettings?.project ?? {}
  const resolved = scan.projectSettings
  const { data: dependencies = [] } = useProjectDependenciesQuery(projectPath)
  const usesAutoImport = dependencies.includes('astro-auto-import')

  const reset = (key: keyof ProjectSettings) => () =>
    void updateProject({ [key]: undefined })

  return (
    <div className="space-y-6">
      <SettingsSection title="Content Config">
        <p className="text-sm">
          {scan.configPath ? (
            <WithCode text={`Read from \`${scan.configPath}\`.`} />
          ) : (
            'No content config found.'
          )}
        </p>
        <ProblemList problems={projectProblems(scan)} />
      </SettingsSection>

      <SettingsSection title="Folders">
        <Setting
          label="Content Folder"
          source={resolved.contentDirectory.source}
          onReset={reset('contentDirectory')}
          description="Where collections are looked for when their loader doesn't say, and whose folders become collections when there's no readable content config."
        >
          {({ id }) => (
            <FolderInput
              id={id}
              value={stored.contentDirectory ?? ''}
              placeholder={resolved.contentDirectory.value}
              start={`${projectPath}/${resolved.contentDirectory.value}`}
              onChange={folder =>
                void updateProject({ contentDirectory: folder })
              }
            />
          )}
        </Setting>

        <Setting
          label="MDX Components Folder"
          source={resolved.mdxComponentsDirectory.source}
          onReset={reset('mdxComponentsDirectory')}
          description="The components the component builder offers in MDX files."
        >
          {({ id }) => (
            <FolderInput
              id={id}
              value={stored.mdxComponentsDirectory ?? ''}
              placeholder={resolved.mdxComponentsDirectory.value}
              start={projectPath}
              onChange={folder =>
                void updateProject({ mdxComponentsDirectory: folder })
              }
            />
          )}
        </Setting>
      </SettingsSection>

      <SettingsSection title="Images">
        <Setting
          label="Assets Folder"
          source={resolved.assetsDirectory.source}
          onReset={reset('assetsDirectory')}
          description={
            <WithCode text="Images you add are copied to `<folder>/<collection>/`. Collections can override this." />
          }
        >
          {({ id }) => (
            <FolderInput
              id={id}
              value={stored.assetsDirectory ?? ''}
              placeholder={resolved.assetsDirectory.value}
              start={`${projectPath}/${resolved.assetsDirectory.value}`}
              onChange={folder =>
                void updateProject({ assetsDirectory: folder })
              }
            />
          )}
        </Setting>

        <Setting
          label="Use Absolute Paths for Images"
          source={resolved.useAbsoluteAssetPaths.source}
          onReset={reset('useAbsoluteAssetPaths')}
          inline
          description={
            <WithCode text="Write image paths from the project root (`/src/assets/image.png`) rather than relative to the file (`../../assets/image.png`), which is Astro's convention. Collections can override this." />
          }
        >
          {({ id }) => (
            <Switch
              id={id}
              checked={resolved.useAbsoluteAssetPaths.value}
              onCheckedChange={checked =>
                void updateProject({ useAbsoluteAssetPaths: checked })
              }
            />
          )}
        </Setting>
      </SettingsSection>

      <SettingsSection title="Experimental">
        <Setting
          label="Add Imports for MDX Components"
          source={resolved.addComponentImports.source}
          onReset={reset('addComponentImports')}
          inline
          description={
            <>
              When you insert a component, also add its{' '}
              <code className="text-xs">import</code> to the file. Leave this
              off if your site imports components automatically.{' '}
              <DocsLink href={DOCS_URLS.mdxComponents}>Learn more</DocsLink>
              {usesAutoImport && (
                <span className="mt-1 block text-foreground">
                  This project uses astro-auto-import. If it imports your MDX
                  components, leave this off, or they'll be imported twice and
                  the build will fail.
                </span>
              )}
            </>
          }
        >
          {({ id }) => (
            <Switch
              id={id}
              checked={resolved.addComponentImports.value}
              onCheckedChange={checked =>
                void updateProject({ addComponentImports: checked })
              }
            />
          )}
        </Setting>
      </SettingsSection>
    </div>
  )
}
