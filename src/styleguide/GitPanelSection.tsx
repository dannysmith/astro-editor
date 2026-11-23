import type { GitChange, GitWorkingTree } from '@/lib/bindings'
import {
  GitPanelView,
  type GitPanelViewProps,
} from '../components/git/GitPanelView'

const NOW = new Date('2026-11-16T12:00:00')
const DAY = 86_400

const change = (
  path: string,
  kind: GitChange['kind'],
  staged = false
): GitChange => ({
  path,
  originalPath: null,
  kind,
  staged,
  unstaged: kind !== 'new' && !staged,
  submodule: false,
})

const ENTRY = change('docs/src/content/docs/guides/harbour.md', 'modified')
const IMAGE = change('docs/src/assets/docs/2026-11-16-harbour.jpg', 'new')
const OLD_IMAGE = change('docs/src/assets/docs/2026-11-16-old-map.png', 'new')
const CONFIG = change('docs/astro.config.mjs', 'modified', true)
const OTHER_ENTRY = change('docs/src/content/docs/guides/tides.md', 'modified')
const OTHER_IMAGE = change('docs/src/assets/docs/2026-11-16-pier.jpg', 'new')

const staged = (c: GitChange): GitChange => ({
  ...c,
  staged: true,
  unstaged: false,
})

const TREE: GitWorkingTree = {
  root: '/Users/writer/dev/widget',
  prefix: 'docs/',
  branch: 'main',
  upstream: 'origin/main',
  ahead: 2,
  behind: 0,
  hasCommits: true,
  operation: null,
  superproject: null,
  outgoing: [
    {
      hash: 'f4e5d6c',
      subject: 'Add “Tides”',
      author: 'Sam Writer',
      time: NOW.getTime() / 1000 - DAY,
    },
    {
      hash: '9a8b7c6',
      subject: 'Fix the harbour photo’s caption',
      author: 'Sam Writer',
      time: NOW.getTime() / 1000 - 2 * DAY,
    },
  ],
  incoming: [],
  changes: [ENTRY, IMAGE, OLD_IMAGE, CONFIG, OTHER_ENTRY],
  staged: [CONFIG],
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

const ENTRY_INFO = { name: 'harbour.md', collection: 'docs' }

type Example = Pick<
  GitPanelViewProps,
  'state' | 'entry' | 'entryChange' | 'used' | 'unused' | 'others'
> & { name: string; staging?: boolean; notStaged?: string[] }

const EXAMPLES: Example[] = [
  {
    name: 'An entry with an image in use, one taken out, and other changes',
    state: { problem: null, tree: TREE },
    entry: ENTRY_INFO,
    entryChange: ENTRY,
    used: [IMAGE],
    unused: [OLD_IMAGE],
    others: [CONFIG, OTHER_ENTRY],
  },
  {
    name: 'Staged, with an image used since',
    entry: ENTRY_INFO,
    entryChange: ENTRY,
    used: [IMAGE],
    unused: [OLD_IMAGE],
    others: [CONFIG, OTHER_ENTRY],
    state: {
      problem: null,
      tree: { ...TREE, staged: [staged(ENTRY), staged(IMAGE), CONFIG] },
    },
    staging: true,
    notStaged: [OTHER_IMAGE.path],
  },
  {
    name: 'A merge in progress, no file open',
    state: {
      problem: null,
      tree: { ...TREE, operation: 'merge', ahead: 1, behind: 3, entry: null },
    },
    entry: null,
    entryChange: null,
    used: [],
    unused: [],
    others: [ENTRY, IMAGE, CONFIG],
  },
  {
    name: 'Not in a repository',
    state: { problem: { kind: 'notARepository' }, tree: null },
    entry: ENTRY_INFO,
    entryChange: null,
    used: [],
    unused: [],
    others: [],
  },
]

/** The Git tab in each state, at the sidebar's width */
export function GitPanelSection() {
  return (
    <div className="flex flex-wrap gap-6">
      {EXAMPLES.map(
        ({ name, used, staging = false, notStaged = [], ...example }) => (
          <div key={name} className="w-80 space-y-2">
            <p className="text-xs text-muted-foreground">{name}</p>
            <div className="h-[34rem] rounded-lg border">
              <GitPanelView
                {...example}
                used={used}
                refreshedAt={0}
                onRefresh={() => {}}
                onDeleteUnused={() => {}}
                renamedFrom={null}
                isTicked={path => used.some(c => c.path === path)}
                onTick={() => {}}
                onOpen={() => {}}
                onFileMenu={() => {}}
                onOpenSettings={() => {}}
                sync={{
                  pending: null,
                  busy: false,
                  pullBlocked: null,
                  error: null,
                  onPush: () => {},
                  onPull: () => {},
                }}
                commit={{
                  staging,
                  ourPaths: [ENTRY.path, IMAGE.path],
                  notStaged,
                  entryNotStaged: false,
                  pending: null,
                  busy: false,
                  stagedElsewhere: null,
                  error: null,
                  committed: null,
                  message: 'Update “Harbour at dawn”',
                  messageTyped: false,
                  focusMessage: false,
                  onMessageFocused: () => {},
                  onMessageChange: () => {},
                  onStage: () => {},
                  onUnstage: () => {},
                  onCommit: () => {},
                }}
                now={NOW}
              />
            </div>
          </div>
        )
      )}
    </div>
  )
}
