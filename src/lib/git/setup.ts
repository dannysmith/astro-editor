import type { GitOperation, GitSetup } from '@/lib/bindings'
import type { Problem } from '../project-settings/status'
import { tildePath } from '../projects/display'

const OPERATION_NAMES: Record<GitOperation, string> = {
  merge: 'A merge',
  rebase: 'A rebase',
  cherryPick: 'A cherry-pick',
  revert: 'A revert',
}

/**
 * What stops the Git panel working for a project, each with what to do about
 * it. Fixing git happens in git, so every fix is something to do there.
 */
export function gitSetupProblems(
  setup: GitSetup,
  home: string | null
): Problem[] {
  switch (setup.problem?.kind) {
    case 'notInstalled':
      return [
        {
          level: 'error',
          message: "Git isn't installed.",
          fix: "Install it with Homebrew (`brew install git`) or with Apple's command line tools (`xcode-select --install`).",
        },
      ]
    case 'commandLineToolsMissing':
      return [
        {
          level: 'error',
          message:
            "Git needs Apple's command line tools, which aren't installed.",
          fix: 'Run `xcode-select --install` in Terminal, or install git with Homebrew.',
        },
      ]
    case 'notARepository':
      return [
        {
          level: 'warning',
          message: "This project isn't in a git repository.",
          fix: 'Run `git init` in the project folder, or turn the Git panel off.',
        },
      ]
    case 'ignored':
      return [
        {
          level: 'warning',
          message: `This project is in a folder that the repository at \`${tildePath(setup.problem.root, home)}\` ignores, so AE treats it as not being in a repository.`,
          fix: 'Give the project its own repository, or stop ignoring its folder.',
        },
      ]
    case 'failed':
      return [
        {
          level: 'error',
          message: "Git couldn't read this project's repository.",
          fix: "This is git's message. Fix it in Terminal or your git tool.",
          detail: setup.problem.message,
        },
      ]
  }

  const repository = setup.repository
  if (!repository) return []
  const problems: Problem[] = []
  if (!repository.userName || !repository.userEmail) {
    problems.push({
      level: 'error',
      message: "Git doesn't know who you are, so committing will fail.",
      fix: 'Set `user.name` and `user.email`, for example with `git config --global user.email "you@example.com"`.',
    })
  }
  if (repository.operation) {
    problems.push({
      level: 'warning',
      message: `${OPERATION_NAMES[repository.operation]} is in progress.`,
      fix: "The Git panel won't commit or push until you finish it in your git tool.",
    })
  } else if (repository.hasCommits && !repository.branch) {
    problems.push({
      level: 'warning',
      message: "HEAD is detached, so there's no branch to commit to.",
      fix: 'Check out a branch in your git tool.',
    })
  }
  return problems
}

/** The branch and how it stands against its upstream, as a sentence */
export function describeBranch(setup: GitSetup): string | null {
  const repository = setup.repository
  if (!repository) return null
  if (!repository.branch) return 'Detached HEAD'
  const branch = `\`${repository.branch}\``
  if (!repository.hasCommits) return `${branch}, no commits yet`
  if (!repository.upstream) {
    return `${branch}, not pushed anywhere yet. Push it from your git tool first.`
  }
  const counts = [
    repository.ahead > 0 && `${repository.ahead} to push`,
    repository.behind > 0 && `${repository.behind} to pull`,
  ].filter(Boolean)
  return `${branch} → \`${repository.upstream}\`${counts.length > 0 ? `, ${counts.join(', ')}` : ', up to date'}`
}
