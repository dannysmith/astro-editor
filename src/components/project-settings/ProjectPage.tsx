import type { ProjectScan, ProjectSettings } from '@/lib/bindings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePreferences } from '../../hooks/usePreferences'
import { useProjectDependenciesQuery } from '../../hooks/queries/useProjectDependenciesQuery'
import { DOCS_URLS } from '../../lib/docs-urls'
import { projectName } from '../../lib/projects/display'
import { clearSavedSettings } from '../../lib/project-settings/actions'
import {
  isUnreadLoader,
  projectProblems,
} from '../../lib/project-settings/status'
import { DocsLink } from '../preferences/DocsLink'
import { ProjectIcon } from '../project-list'
import { ProblemCallout, WithCode } from './Problems'
import {
  FolderInput,
  FolderList,
  PageHeader,
  Setting,
  SettingSelect,
  SettingsGroup,
} from './Setting'

/**
 * What was read from the content config, as a sentence. When there's nothing
 * to edit, the problem below says so, so this doesn't.
 */
function describeConfig(scan: ProjectScan): string | null {
  if (!scan.configPath || scan.fallback) return null
  const read = `Read from \`${scan.configPath}\``
  if (scan.collections.every(c => c.kind === 'data')) return `${read}.`
  const others = scan.collections.filter(
    c => c.kind === 'data' || isUnreadLoader(c)
  ).length
  const editable = scan.collections.length - others
  const count = (n: number, one: string, many: string) =>
    `${n === 0 ? 'no' : n} ${n === 1 ? one : many}`
  return `${read}: ${count(editable, 'collection', 'collections')} to edit${others > 0 ? `, and ${count(others, 'other', 'others')}` : ''}.`
}

/**
 * The project: what was read from its content config and anything wrong, the
 * settings for the whole project, and settings saved for collections it no
 * longer has
 */
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
  const config = describeConfig(scan)

  // With the folder fallback, the config's collections aren't known, so
  // nothing saved for them is offered for clearing
  const removed = scan.fallback
    ? []
    : Object.keys(projectSettings?.collections ?? {}).filter(
        name => !scan.collections.some(c => c.name === name)
      )

  const reset = (key: keyof ProjectSettings) => () =>
    void updateProject({ [key]: undefined })

  return (
    <div className="space-y-6">
      <PageHeader
        icon={
          <ProjectIcon
            path={projectPath}
            favicon={scan.favicon}
            className="size-10"
          />
        }
        title={<span className="font-mono">{projectName(projectPath)}</span>}
      >
        {config && <WithCode text={config} />}
      </PageHeader>

      {projectProblems(scan).map(problem => (
        <ProblemCallout key={problem.message} problem={problem} />
      ))}

      <SettingsGroup title="MDX Components">
        <Setting
          label="Folders"
          help="Components in these folders can be inserted with ⌘/."
          source={resolved.mdxComponentsDirectories.source}
          onReset={reset('mdxComponentsDirectories')}
          resetTo="src/components/mdx"
          wide
        >
          {() => (
            <FolderList
              folders={resolved.mdxComponentsDirectories.value}
              start={projectPath}
              onChange={folders =>
                void updateProject({ mdxComponentsDirectories: folders })
              }
            />
          )}
        </Setting>

        <Setting
          label={
            <>
              Add imports{' '}
              <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                Experimental
              </Badge>
            </>
          }
          help={
            usesAutoImport ? (
              <span className="text-warning">
                This project uses astro-auto-import. If it imports your
                components, leave this off, or they'll be imported twice and the
                build will fail.
              </span>
            ) : (
              <>
                Add a component's import when you insert it. Leave this off if
                your site imports them for you.{' '}
                <DocsLink href={DOCS_URLS.mdxComponents}>Learn more</DocsLink>
              </>
            )
          }
          source={resolved.addComponentImports.source}
          onReset={reset('addComponentImports')}
          resetTo="off"
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
      </SettingsGroup>

      <SettingsGroup title="Images" note="Each collection can change these.">
        <Setting
          label="Folder"
          help="Each collection's images go in a folder named after it."
          source={resolved.assetsDirectory.source}
          onReset={reset('assetsDirectory')}
          resetTo="src/assets"
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
          label="Image paths"
          source={resolved.useAbsoluteAssetPaths.source}
          onReset={reset('useAbsoluteAssetPaths')}
          resetTo="relative to the file"
        >
          {({ labelId }) => (
            <SettingSelect
              labelId={labelId}
              value={
                resolved.useAbsoluteAssetPaths.value ? 'absolute' : 'relative'
              }
              onChange={value =>
                void updateProject({
                  useAbsoluteAssetPaths: value === 'absolute',
                })
              }
              choices={[
                { value: 'relative', label: 'Relative to the file' },
                { value: 'absolute', label: 'From the project root' },
              ]}
            />
          )}
        </Setting>
      </SettingsGroup>

      <SettingsGroup title="Content">
        <Setting
          label="Content folder"
          help="Collections are looked for here when the content config doesn't say where they are."
          source={resolved.contentDirectory.source}
          onReset={reset('contentDirectory')}
          resetTo="src/content"
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
      </SettingsGroup>

      {removed.length > 0 && (
        <SettingsGroup title="Removed Collections">
          <Setting
            label={
              <WithCode
                text={`Settings for ${removed.map(name => `\`${name}\``).join(', ')}`}
              />
            }
            help="These collections are no longer in the content config."
            source="convention"
          >
            {() => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void clearSavedSettings(removed)}
              >
                Clear
              </Button>
            )}
          </Setting>
        </SettingsGroup>
      )}
    </div>
  )
}
