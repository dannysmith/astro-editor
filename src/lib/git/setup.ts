import type {
  GitChange,
  GitOperation,
  GitProblem,
  GitSetup,
} from '@/lib/bindings'
import type { Problem } from '../project-settings/status'
import { tildePath } from '../projects/display'

const OPERATION_NAMES: Record<GitOperation, string> = {
  merge: 'A merge',
  rebase: 'A rebase',
  cherryPick: 'A cherry-pick',
  revert: 'A revert',
}

/** The branch fields that the setup report and the Git tab's state share */
interface BranchState {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  hasCommits: boolean
  operation: GitOperation | null
}

/**
 * What stops the Git panel working for a project, each with what to do about
 * it. Fixing git happens in git, so every fix is something to do there.
 */
export function gitSetupProblems(
  setup: GitSetup,
  home: string | null
): Problem[] {
  if (setup.problem) return [gitProblem(setup.problem, home)]
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
  const readOnly = readOnlyReason(repository)
  if (readOnly) problems.push(readOnly)
  return problems
}

/** Why git can't be used for the project, and what to do about it */
export function gitProblem(problem: GitProblem, home: string | null): Problem {
  switch (problem.kind) {
    case 'notInstalled':
      return {
        level: 'error',
        message: "Git isn't installed.",
        fix: "Install it with Homebrew (`brew install git`) or with Apple's command line tools (`xcode-select --install`).",
      }
    case 'commandLineToolsMissing':
      return {
        level: 'error',
        message:
          "Git needs Apple's command line tools, which aren't installed.",
        fix: 'Run `xcode-select --install` in Terminal, or install git with Homebrew.',
      }
    case 'notARepository':
      return {
        level: 'warning',
        message: "This project isn't in a git repository.",
        fix: 'Run `git init` in the project folder, or turn the Git panel off.',
      }
    case 'ignored':
      return {
        level: 'warning',
        message: `This project is in a folder that the repository at \`${tildePath(problem.root, home)}\` ignores, so AE treats it as not being in a repository.`,
        fix: 'Give the project its own repository, or stop ignoring its folder.',
      }
    case 'failed':
      return {
        level: 'error',
        message: "Git couldn't read this project's repository.",
        fix: "This is git's message. Fix it in Terminal or your git tool.",
        detail: problem.message,
      }
  }
}

/**
 * Why the Git panel won't commit or push right now: git is in the middle of
 * something, HEAD is detached, or files have conflicts. All of these are
 * finished in a git tool.
 */
export function readOnlyReason(
  state: BranchState,
  changes: GitChange[] = []
): Problem | null {
  if (state.operation) {
    return {
      level: 'warning',
      message: `${OPERATION_NAMES[state.operation]} is in progress.`,
      fix: "The Git panel won't commit or push until you finish it in your git tool.",
    }
  }
  if (state.hasCommits && !state.branch) {
    return {
      level: 'warning',
      message: "HEAD is detached, so there's no branch to commit to.",
      fix: 'Check out a branch in your git tool.',
    }
  }
  if (changes.some(change => change.kind === 'conflicted')) {
    return {
      level: 'warning',
      message: 'Some files have conflicts.',
      fix: 'Resolve them in your git tool.',
    }
  }
  return null
}

/** The branch and how it stands against its upstream, as a sentence */
export function describeBranch(state: BranchState): string {
  if (!state.branch) return 'Detached HEAD'
  const branch = `\`${state.branch}\``
  if (!state.hasCommits) return `${branch}, no commits yet`
  if (!state.upstream) {
    return `${branch}, not pushed anywhere yet. Push it from your git tool first.`
  }
  const counts = [
    state.ahead > 0 && `${state.ahead} to push`,
    state.behind > 0 && `${state.behind} to pull`,
  ].filter(Boolean)
  return `${branch} → \`${state.upstream}\`${counts.length > 0 ? `, ${counts.join(', ')}` : ', up to date'}`
}

/**
 * How the branch stands against its upstream, for under the branch's name in
 * the Git tab, like "2 to push to `origin/main`"
 */
export function describeUpstream(state: BranchState): string {
  if (!state.branch) return 'Not on a branch'
  if (!state.hasCommits) return 'No commits yet'
  if (!state.upstream) return 'Not pushed anywhere yet'
  const upstream = `\`${state.upstream}\``
  if (state.ahead > 0 && state.behind > 0) {
    return `${state.ahead} to push and ${state.behind} to pull, with ${upstream}`
  }
  if (state.ahead > 0) return `${state.ahead} to push to ${upstream}`
  if (state.behind > 0) return `${state.behind} to pull from ${upstream}`
  return `Up to date with ${upstream}`
}
