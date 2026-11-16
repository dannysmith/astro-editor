import type { GitChange, GitState, GitWorkingTree } from '@/lib/bindings'
import { GitPanelView } from '../components/git/GitPanelView'

const NOW = new Date('2026-11-16T12:00:00')
const DAY = 86_400

const change = (path: string, kind: GitChange['kind']): GitChange => ({
  path,
  originalPath: null,
  kind,
  submodule: false,
})

const ENTRY = change('docs/src/content/docs/guides/harbour.md', 'modified')
const IMAGE = change('docs/src/assets/docs/2026-11-16-harbour.jpg', 'new')
const OTHER = change('docs/astro.config.mjs', 'modified')

const TREE: GitWorkingTree = {
  root: '/Users/writer/dev/widget',
  prefix: 'docs/',
  branch: 'main',
  upstream: 'origin/main',
  ahead: 2,
  behind: 0,
  hasCommits: true,
  operation: null,
  changes: [ENTRY, IMAGE, OTHER],
  entry: {
    path: ENTRY.path,
    state: 'modified',
    lastCommit: {
      hash: 'a1b2c3d',
      subject: 'Add “Harbour at dawn”',
      author: 'Sam Writer',
      time: NOW.getTime() / 1000 - 3 * DAY,
    },
  },
}

const STATES: {
  name: string
  state: GitState
  title: string | null
  entry: GitChange[]
  others: GitChange[]
}[] = [
  {
    name: 'An entry with an image, and another change',
    state: { problem: null, tree: TREE },
    title: 'Harbour at dawn',
    entry: [ENTRY, IMAGE],
    others: [OTHER],
  },
  {
    name: 'A merge in progress, no file open',
    state: {
      problem: null,
      tree: { ...TREE, operation: 'merge', ahead: 0, behind: 3, entry: null },
    },
    title: null,
    entry: [],
    others: [ENTRY, IMAGE, OTHER],
  },
  {
    name: 'Not in a repository',
    state: { problem: { kind: 'notARepository' }, tree: null },
    title: 'Harbour at dawn',
    entry: [],
    others: [],
  },
]

/** The Git tab in each state, at the sidebar's width */
export function GitPanelSection() {
  return (
    <div className="flex flex-wrap gap-6">
      {STATES.map(({ name, state, title, entry, others }) => (
        <div key={name} className="w-80 space-y-2">
          <p className="text-xs text-muted-foreground">{name}</p>
          <div className="h-96 rounded-lg border">
            <GitPanelView
              state={state}
              refreshing={false}
              onRefresh={() => {}}
              title={title}
              entryChanges={entry}
              otherChanges={others}
              isTicked={path => entry.some(c => c.path === path)}
              onTick={() => {}}
              onOpen={() => {}}
              onOpenSettings={() => {}}
              now={NOW}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
