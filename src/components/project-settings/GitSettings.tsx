import React from 'react'
import { RefreshCw } from 'lucide-react'
import type { GitSetup, Resolved, SettingSource } from '@/lib/bindings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { usePreferences } from '../../hooks/usePreferences'
import { useGitSetupQuery } from '../../hooks/queries/useGitSetupQuery'
import { describeBranch, gitSetupProblems } from '../../lib/git/setup'
import { tildePath } from '../../lib/projects/display'
import { ProblemCallout, WithCode } from './Problems'
import { Setting, SettingsGroup } from './Setting'

/** Git's signature formats (`gpg.format`), as people know them */
const SIGNING_NAMES: Record<string, string> = {
  openpgp: 'GPG',
  ssh: 'an SSH key',
  x509: 'S/MIME',
}

/**
 * The project page's Git group: the experimental Git panel's switch and, while
 * it's on, what AE found out about git for the project. Git only runs while
 * the switch is on.
 */
export function GitSettings({
  projectPath,
  gitPanel,
}: {
  projectPath: string
  gitPanel: Resolved<boolean>
}) {
  const { updateProject } = usePreferences()
  const { data, error, isFetching, refetch } = useGitSetupQuery(
    projectPath,
    gitPanel.value
  )
  return (
    <GitSettingsView
      on={gitPanel.value}
      source={gitPanel.source}
      onChange={checked => void updateProject({ gitPanel: checked })}
      onReset={() => void updateProject({ gitPanel: undefined })}
      setup={data?.setup}
      home={data?.home ?? null}
      error={error?.message}
      checking={isFetching}
      onCheckAgain={() => void refetch()}
    />
  )
}

interface GitSettingsViewProps {
  on: boolean
  source: SettingSource
  onChange: (on: boolean) => void
  onReset?: () => void
  /** Undefined until the first check finishes */
  setup?: GitSetup
  home: string | null
  /** The command failed outright, rather than git reporting a problem */
  error?: string
  checking: boolean
  onCheckAgain: () => void
}

/** The Git group, from what's passed in. See `GitSettings`. */
export function GitSettingsView({
  on,
  source,
  onChange,
  onReset,
  setup,
  home,
  error,
  checking,
  onCheckAgain,
}: GitSettingsViewProps) {
  const problems = setup ? gitSetupProblems(setup, home) : []
  return (
    <>
      <SettingsGroup
        title="Git"
        note={
          on && (
            <Button
              variant="ghost"
              size="sm"
              className="-my-1 h-6 gap-1 px-2 text-xs"
              onClick={onCheckAgain}
              disabled={checking}
            >
              <RefreshCw className={cn(checking && 'animate-spin')} />
              Check again
            </Button>
          )
        }
      >
        <Setting
          label={
            <>
              Git panel{' '}
              <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                Experimental
              </Badge>
            </>
          }
          help="A Git tab in the right sidebar (⌘4) for committing the open file with its images, and pushing. It uses your own git and its settings."
          source={source}
          onReset={onReset}
          resetTo="off"
        >
          {({ id }) => (
            <Switch id={id} checked={on} onCheckedChange={onChange} />
          )}
        </Setting>
        {on && !setup && !error && <InfoRow label="Git">Checking…</InfoRow>}
        {on && setup && <SetupRows setup={setup} home={home} />}
      </SettingsGroup>

      {on && error && (
        <ProblemCallout
          problem={{
            level: 'error',
            message: "AE couldn't check git for this project.",
            detail: error,
          }}
        />
      )}
      {on &&
        problems.map(problem => (
          <ProblemCallout key={problem.message} problem={problem} />
        ))}
    </>
  )
}

/** What was found: the git program, the repository, branch, identity, hooks */
function SetupRows({ setup, home }: { setup: GitSetup; home: string | null }) {
  const path = (p: string) => `\`${tildePath(p, home)}\``
  const repository = setup.repository
  const branch = describeBranch(setup)
  return (
    <>
      {setup.git && (
        <InfoRow label="Git">
          <WithCode text={`${path(setup.git.path)} ${setup.git.version}`} />
        </InfoRow>
      )}
      {repository && (
        <>
          <InfoRow
            label="Repository"
            help={
              repository.superproject
                ? `A submodule of ${path(repository.superproject)}. Pushing doesn't update its pointer there.`
                : undefined
            }
          >
            <WithCode
              text={
                repository.projectFolder
                  ? `${path(repository.root)}, project in \`${repository.projectFolder}\``
                  : path(repository.root)
              }
            />
          </InfoRow>
          {branch && (
            <InfoRow label="Branch">
              <WithCode text={branch} />
            </InfoRow>
          )}
          <InfoRow
            label="Commit as"
            help={
              repository.userName && repository.userEmail
                ? `Set in ${[
                    ...new Set([
                      repository.userName.origin,
                      repository.userEmail.origin,
                    ]),
                  ]
                    .map(path)
                    .join(' and ')}`
                : undefined
            }
          >
            {repository.userName && repository.userEmail
              ? `${repository.userName.value} <${repository.userEmail.value}>`
              : 'Not set'}
          </InfoRow>
          {repository.signing && (
            <InfoRow
              label="Signing"
              help="A commit may ask for your key's passphrase, or wait while it's signed."
            >
              {`Commits are signed with ${SIGNING_NAMES[repository.signing] ?? repository.signing}`}
            </InfoRow>
          )}
          <InfoRow
            label="Hooks"
            help={
              repository.hooks.length > 0
                ? 'They run when you commit or push from AE, as they do in Terminal.'
                : undefined
            }
          >
            {repository.hooks.length > 0 ? (
              <WithCode
                text={repository.hooks.map(hook => `\`${hook}\``).join(', ')}
              />
            ) : (
              'None'
            )}
          </InfoRow>
        </>
      )}
    </>
  )
}

/** A value AE read, with its label and an optional line about it */
function InfoRow({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
      <div className="shrink-0 space-y-0.5">
        <p>{label}</p>
      </div>
      <div className="min-w-0 space-y-0.5 text-right">
        <p className="break-words text-muted-foreground">{children}</p>
        {help && (
          <p className="text-xs text-muted-foreground">
            <WithCode text={help} />
          </p>
        )}
      </div>
    </div>
  )
}
