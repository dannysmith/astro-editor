import { describe, it, expect } from 'vitest'
import type { GitRepository, GitSetup } from '@/lib/bindings'
import {
  describeBranch,
  describeUpstream,
  gitSetupProblems,
  readOnlyReason,
} from './setup'

const HOME = '/Users/writer'

function repository(overrides: Partial<GitRepository> = {}): GitRepository {
  return {
    root: `${HOME}/sites/blog`,
    projectFolder: null,
    superproject: null,
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    hasCommits: true,
    operation: null,
    userName: { value: 'Writer', origin: `${HOME}/.gitconfig` },
    userEmail: { value: 'writer@example.com', origin: `${HOME}/.gitconfig` },
    signing: null,
    hooks: [],
    ...overrides,
  }
}

function setup(overrides: Partial<GitSetup> = {}): GitSetup {
  return {
    git: { path: '/opt/homebrew/bin/git', version: '2.56.1' },
    problem: null,
    repository: repository(),
    ...overrides,
  }
}

describe('gitSetupProblems', () => {
  it('has none for a working repository', () => {
    expect(gitSetupProblems(setup(), HOME)).toEqual([])
  })

  it('says how to fix git not being there', () => {
    const [problem] = gitSetupProblems(
      setup({ git: null, problem: { kind: 'notInstalled' }, repository: null }),
      HOME
    )
    expect(problem?.level).toBe('error')
    expect(problem?.fix).toContain('brew install git')
  })

  it('names the repository that ignores the project, from home', () => {
    const [problem] = gitSetupProblems(
      setup({
        problem: { kind: 'ignored', root: `${HOME}/dev/parent` },
        repository: null,
      }),
      HOME
    )
    expect(problem?.message).toContain('`~/dev/parent`')
  })

  it("passes git's own message on", () => {
    const [problem] = gitSetupProblems(
      setup({
        problem: {
          kind: 'failed',
          message: 'fatal: detected dubious ownership',
        },
        repository: null,
      }),
      HOME
    )
    expect(problem?.detail).toBe('fatal: detected dubious ownership')
  })

  it('flags a missing identity, and an operation over a detached HEAD', () => {
    const problems = gitSetupProblems(
      setup({
        repository: repository({
          userEmail: null,
          branch: null,
          operation: 'rebase',
        }),
      }),
      HOME
    )
    expect(problems.map(p => p.message)).toEqual([
      "Git doesn't know who you are, so committing will fail.",
      'A rebase is in progress.',
    ])
  })

  it('flags a detached HEAD, but not a repository with no commits yet', () => {
    const detached = setup({ repository: repository({ branch: null }) })
    expect(gitSetupProblems(detached, HOME)).toHaveLength(1)
    const empty = setup({
      repository: repository({ hasCommits: false, upstream: null }),
    })
    expect(gitSetupProblems(empty, HOME)).toEqual([])
  })
})

describe('describeBranch', () => {
  it('counts commits each way', () => {
    expect(describeBranch(repository({ ahead: 2, behind: 1 }))).toBe(
      '`main` → `origin/main`, 2 to push, 1 to pull'
    )
    expect(describeBranch(repository())).toBe(
      '`main` → `origin/main`, up to date'
    )
  })

  it('says when there is nowhere to push', () => {
    expect(describeBranch(repository({ upstream: null }))).toBe(
      '`main`, not pushed anywhere yet. Push it from your git tool first.'
    )
  })

  it('describes a new repository and a detached HEAD', () => {
    expect(describeBranch(repository({ hasCommits: false }))).toBe(
      '`main`, no commits yet'
    )
    expect(describeBranch(repository({ branch: null }))).toBe('Detached HEAD')
  })
})

describe('describeUpstream', () => {
  it('says which way commits need to go', () => {
    expect(describeUpstream(repository({ ahead: 2 }))).toBe(
      '2 to push to `origin/main`'
    )
    expect(describeUpstream(repository({ behind: 1 }))).toBe(
      '1 to pull from `origin/main`'
    )
    expect(describeUpstream(repository({ ahead: 2, behind: 1 }))).toBe(
      '2 to push and 1 to pull, with `origin/main`'
    )
    expect(describeUpstream(repository())).toBe('Up to date with `origin/main`')
    expect(describeUpstream(repository({ upstream: null }))).toBe(
      'Not pushed anywhere yet'
    )
  })
})

describe('readOnlyReason', () => {
  it('stops for conflicted files', () => {
    const conflict = {
      path: 'a.md',
      originalPath: null,
      kind: 'conflicted' as const,
      submodule: false,
    }
    expect(readOnlyReason(repository(), [conflict])?.message).toBe(
      'Some files have conflicts.'
    )
    expect(readOnlyReason(repository())).toBeNull()
  })
})
