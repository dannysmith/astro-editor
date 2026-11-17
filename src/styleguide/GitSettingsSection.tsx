import type { GitRepository, GitSetup } from '@/lib/bindings'
import { GitSettingsView } from '../components/project-settings/GitSettings'

const HOME = '/Users/writer'

const REPOSITORY: GitRepository = {
  root: `${HOME}/dev/widget`,
  projectFolder: 'docs',
  superproject: null,
  branch: 'main',
  upstream: 'origin/main',
  ahead: 2,
  behind: 0,
  hasCommits: true,
  operation: null,
  userName: { value: 'Sam Writer', origin: `${HOME}/.gitconfig` },
  userEmail: { value: 'sam@example.com', origin: '.git/config' },
  signing: 'ssh',
  hooks: ['pre-commit', 'pre-push'],
}

const GIT = { path: '/opt/homebrew/bin/git', version: '2.56.1' }

interface State {
  name: string
  setup?: GitSetup
  error?: string
}

const WORKING: State[] = [
  {
    name: 'A site in a monorepo, with signing and hooks',
    setup: { git: GIT, problem: null, repository: REPOSITORY },
  },
]

const PROBLEMS: State[] = [
  {
    name: 'No identity, in the middle of a merge',
    setup: {
      git: GIT,
      problem: null,
      repository: {
        ...REPOSITORY,
        projectFolder: null,
        userName: null,
        userEmail: null,
        signing: null,
        hooks: [],
        operation: 'merge',
      },
    },
  },
  {
    name: 'Not in a repository',
    setup: { git: GIT, problem: { kind: 'notARepository' }, repository: null },
  },
  {
    name: 'Git failed',
    setup: {
      git: GIT,
      problem: {
        kind: 'failed',
        message: `fatal: detected dubious ownership in repository at '${HOME}/dev/widget'`,
      },
      repository: null,
    },
  },
  { name: 'Checking' },
]

function States({ states }: { states: State[] }) {
  return (
    <div className="max-w-3xl space-y-10 rounded-lg border p-6">
      {states.map(({ name, setup, error }) => (
        <div key={name} className="space-y-3">
          <p className="text-xs text-muted-foreground">{name}</p>
          <GitSettingsView
            on
            source="set"
            onChange={() => {}}
            onReset={() => {}}
            setup={setup}
            home={HOME}
            error={error}
            checking={!setup}
            onCheckAgain={() => {}}
            remoteCheck={{
              checking: false,
              url: null,
              error: null,
              onCheck: () => {},
            }}
          />
        </div>
      ))}
    </div>
  )
}

/** The project page's Git group, working */
export function GitSettingsSection() {
  return <States states={WORKING} />
}

/** The Git group's problems, and while it checks */
export function GitSettingsProblemsSection() {
  return <States states={PROBLEMS} />
}
