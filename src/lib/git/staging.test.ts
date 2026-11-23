import { describe, expect, it } from 'vitest'
import type { GitChange, GitWorkingTree } from '@/lib/bindings'
import { stagingState, type Staging } from './staging'

const staged = (path: string): GitChange => ({
  path,
  originalPath: null,
  kind: 'modified',
  staged: true,
  unstaged: false,
  submodule: false,
})

/** A tree with `paths` staged, `ahead` commits to push */
const tree = (paths: string[], ahead = 0): GitWorkingTree => ({
  root: '/site',
  prefix: '',
  branch: 'main',
  upstream: 'origin/main',
  ahead,
  behind: 0,
  hasCommits: true,
  operation: null,
  superproject: null,
  outgoing: [],
  incoming: [],
  changes: [],
  staged: paths.map(staged),
  entry: null,
})

const TRIP: Staging = {
  project: '/site',
  entry: '/site/posts/trip.md',
  paths: ['posts/trip.md', 'assets/map.png'],
}

describe('stagingState', () => {
  it('opens the card for the entry the files were staged for', () => {
    const state = stagingState({
      staging: TRIP,
      project: '/site',
      entry: '/site/posts/trip.md',
      tree: tree(['posts/trip.md', 'assets/map.png']),
    })
    expect(state).toEqual({
      ours: TRIP.paths,
      elsewhere: null,
      pullBlocked: null,
    })
  })

  it('says another entry has files staged', () => {
    const state = stagingState({
      staging: TRIP,
      project: '/site',
      entry: '/site/posts/other.md',
      tree: tree(['posts/trip.md']),
    })
    expect(state.ours).toBeNull()
    expect(state.elsewhere).toBe(TRIP)
  })

  it('forgets staging that was committed or unstaged elsewhere', () => {
    const state = stagingState({
      staging: TRIP,
      project: '/site',
      entry: '/site/posts/trip.md',
      // Something else staged since, in another app
      tree: tree(['README.md']),
    })
    expect(state.ours).toBeNull()
    expect(state.elsewhere).toBeNull()
  })

  it("ignores another project's staging", () => {
    const state = stagingState({
      staging: TRIP,
      project: '/other-site',
      entry: '/site/posts/trip.md',
      tree: tree(['posts/trip.md']),
    })
    expect(state.ours).toBeNull()
    expect(state.elsewhere).toBeNull()
  })

  it('blocks Pull while anything is staged and the branch is ahead', () => {
    const outsideAE = (ahead: number) =>
      stagingState({
        staging: null,
        project: '/site',
        entry: '/site/posts/trip.md',
        tree: tree(['README.md'], ahead),
      }).pullBlocked
    expect(outsideAE(1)).toMatch(/staged/)
    // A fast-forward keeps what's staged
    expect(outsideAE(0)).toBeNull()
    expect(
      stagingState({
        staging: null,
        project: '/site',
        entry: null,
        tree: tree([], 1),
      }).pullBlocked
    ).toBeNull()
  })
})
