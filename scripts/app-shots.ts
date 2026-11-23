// The website's screenshots as data, for `bun run app shots`. Each entry says how
// to get the app into the right state, so everything can be retaken after a UI
// change. Shots use the demo repo from `scripts/make-git-test-repos.sh demo`.
import { homedir } from 'node:os'
import path from 'node:path'
import { PNG } from 'pngjs'
import type { Scene } from '../src/lib/agent-bridge/api'

export const DEMO_PROJECT = path.join(
  homedir(),
  'dev/temp-git-repos-for-ae-testing/demo-project'
)

export type ShotStep =
  | { run: string }
  | { click: string }
  | { clickSelector: string }
  | { key: string }
  /** A file in the project to record as copied in for the open entry */
  | { added: string }
  | { waitForIssues: true }
  /** Scrolls the first element with exactly this text to the top of its pane */
  | { scrollTo: string }
  /** Swaps text on the page, for details that shouldn't be in a public image */
  | { replaceText: [from: string, to: string] }
  | { js: string }

export interface Shot {
  /** The file name in `website/src/assets`, without `.png` */
  name: string
  theme: 'light' | 'dark'
  /** The window's size in logical pixels */
  size: [width: number, height: number]
  /** Adds the macOS window's rounded corners and shadow */
  frame: boolean
  /** Keeps only this part of the window, in logical pixels, instead of a frame */
  crop?: [x: number, y: number, width: number, height: number]
  /** Crops to the smallest element around `text` that also contains `contains` */
  cropTo?: { text: string; contains: string }
  /** Writes only the raw snapshot, for another script to build on */
  rawOnly?: boolean
  /** Relative to the project's `src/content` */
  file?: string
  scene?: Partial<Scene>
  gitPanel?: boolean
  steps?: ShotStep[]
  /** Undoes anything the steps changed in the demo repo */
  after?: ShotStep[]
}

export const DEFAULT_SCENE: Scene = {
  left: true,
  right: true,
  tab: 'frontmatter',
  focus: false,
  typewriter: false,
  highlights: {
    nouns: false,
    verbs: false,
    adjectives: false,
    adverbs: false,
    conjunctions: false,
  },
  checks: { spelling: false, grammar: false, style: false },
  // The demo content is in American English
  dialect: 'american',
}

const LISBON = 'articles/travel/weekend-in-lisbon.md'
const PODCAST = 'notes/habit-formation-podcast.md'
const PASTA = 'notes/one-pot-pasta-recipe.mdx'
const HABITS = 'books/atomic-habits.mdx'
const DRAFT = 'articles/lifestyle/walking-to-work.md'
const UNUSED_IMAGE = 'src/assets/articles/lisbon-custard-tarts.jpg'
const ALL_CHECKS = { spelling: true, grammar: true, style: true }

const mainDemo = (theme: Shot['theme']): Shot => ({
  name: `main-demo-image-${theme}`,
  theme,
  size: [1840, 1005],
  frame: true,
  file: HABITS,
})

const gitShot = (name: string, extra: Partial<Shot> = {}): Shot => ({
  name,
  theme: 'light',
  size: [1464, 894],
  frame: true,
  file: LISBON,
  gitPanel: true,
  scene: { left: false, tab: 'git' },
  ...extra,
  steps: [{ added: UNUSED_IMAGE }, ...(extra.steps ?? [])],
})

const checksShot = (name: string, steps: ShotStep[] = []): Shot => ({
  name,
  theme: 'light',
  size: [1464, 894],
  frame: true,
  file: DRAFT,
  scene: { left: false, tab: 'copyedit', checks: ALL_CHECKS },
  steps: [{ waitForIssues: true }, ...steps],
})

const projectSettingsShot = (name: string, steps: ShotStep[]): Shot => ({
  name,
  theme: 'light',
  size: [1356, 882],
  frame: false,
  steps: [{ run: 'project-settings' }, ...steps],
})

// Outlines and names the window's four areas, for the introduction page
const LABEL_PANES = `
  const top = document.getElementById('main-editor').getBoundingClientRect().top
  const rectOf = id => document.getElementById(id).getBoundingClientRect()
  const panes = [
    ['Unified Toolbar', '#3f7f1f', { left: 0, top: 0, width: innerWidth, height: top }],
    ['Left Sidebar', '#c8401f', rectOf('left-sidebar')],
    ['Main Editor', '#00a8e8', rectOf('main-editor')],
    ['Right Sidebar', '#a94ba6', rectOf('right-sidebar')],
  ]
  const layer = document.createElement('div')
  layer.id = 'shot-pane-labels'
  layer.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none'
  for (const [name, colour, r] of panes) {
    const box = document.createElement('div')
    box.style.cssText = 'position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:3px solid ' + colour + ';left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px'
    const label = document.createElement('span')
    label.textContent = name
    label.style.cssText = 'font:700 22px var(--editor-font-family);padding:2px 10px;border-radius:6px;background:#fff;color:' + colour
    box.append(label)
    layer.append(box)
  }
  document.body.append(layer)`

export const SHOTS: Shot[] = [
  mainDemo('light'),
  mainDemo('dark'),
  {
    name: 'frontmatter-sidebar-overview',
    theme: 'light',
    size: [1553, 949],
    frame: true,
    file: PASTA,
    scene: { left: false },
  },
  {
    name: 'ai-intro-screenshot',
    theme: 'light',
    size: [1171, 807],
    frame: true,
    file: PASTA,
    scene: {
      left: false,
      highlights: { ...DEFAULT_SCENE.highlights, nouns: true },
    },
  },
  {
    name: 'pane-overview',
    theme: 'light',
    size: [1100, 727],
    frame: true,
    file: LISBON,
    steps: [{ js: LABEL_PANES }],
    after: [{ js: `document.getElementById('shot-pane-labels').remove()` }],
  },
  {
    name: 'file-manager-3',
    theme: 'light',
    size: [1185, 700],
    frame: true,
    file: PODCAST,
    scene: { right: false },
  },
  {
    name: 'file-manager-drafts-filter',
    theme: 'light',
    size: [1185, 700],
    frame: true,
    file: PODCAST,
    scene: { right: false },
    steps: [{ click: 'Show Drafts Only' }],
  },
  {
    name: 'file-manager-sort',
    theme: 'light',
    size: [1185, 700],
    frame: false,
    crop: [0, 44, 506, 515],
    file: PODCAST,
    scene: { right: false },
    steps: [{ click: 'Show Filters' }, { clickSelector: '[role="combobox"]' }],
    after: [{ key: 'escape' }],
  },
  {
    name: 'command-palette',
    theme: 'light',
    size: [1055, 714],
    frame: true,
    file: LISBON,
    scene: { left: false, right: false },
    steps: [{ key: 'mod+p' }],
    after: [{ key: 'escape' }],
  },
  {
    name: 'prefs-general',
    theme: 'light',
    size: [1185, 711],
    frame: true,
    file: HABITS,
    scene: { left: false, right: false },
    steps: [{ run: 'open-preferences' }],
    after: [{ key: 'escape' }],
  },
  {
    name: 'prefs-copyedit',
    theme: 'light',
    size: [1185, 711],
    frame: true,
    file: HABITS,
    scene: { left: false, right: false },
    steps: [{ run: 'open-preferences' }, { click: 'Copyedit' }],
    after: [{ key: 'escape' }],
  },
  projectSettingsShot('project-settings-project', []),
  // The preset makes the name pattern show as "Set by you"
  projectSettingsShot('project-settings-collection', [
    { click: 'articles' },
    { click: 'Date and title' },
    {
      js: `document.querySelectorAll('[role="dialog"] *').forEach(el => { el.scrollTop = 0 })`,
    },
  ]),
  projectSettingsShot('project-settings-frontmatter', [
    { click: 'articles' },
    { scrollTo: 'Description' },
  ]),
  {
    ...projectSettingsShot('project-settings-git', [
      { scrollTo: 'Git' },
      {
        replaceText: [
          '~/dev/temp-git-repos-for-ae-testing/demo-project',
          '~/sites/demo-project',
        ],
      },
    ]),
    gitPanel: true,
  },
  {
    name: 'og-window',
    theme: 'light',
    size: [1320, 900],
    frame: false,
    rawOnly: true,
    file: LISBON,
  },
  {
    name: 'copyedit-panel',
    theme: 'light',
    size: [1464, 894],
    frame: true,
    file: PASTA,
    scene: {
      left: false,
      tab: 'copyedit',
      highlights: { ...DEFAULT_SCENE.highlights, nouns: true, verbs: true },
    },
  },
  checksShot('copyedit-checks'),
  checksShot('copyedit-issue-popover', [{ click: 'fourty' }]),
  gitShot('git-tab'),
  gitShot('git-commit-card', {
    steps: [{ click: 'Stage 3 files' }],
    after: [{ click: 'Cancel' }],
  }),
  gitShot('git-repository-strip', {
    frame: false,
    cropTo: { text: 'origin/main', contains: 'Push' },
  }),
  gitShot('git-files', {
    frame: false,
    cropTo: { text: 'Files it uses', contains: 'No longer used in the entry' },
  }),
]

// The panel widths shots are taken at: the app's defaults, as a new user sees
export const SHOT_PANEL_LAYOUT = {
  'left-sidebar': 20,
  'main-editor': 55,
  'right-sidebar': 25,
}

/** Picks shots by name, or all of them. Unknown names are an error. */
export function selectShots(names: string[]): Shot[] {
  if (!names.length) return SHOTS
  return names.map(name => {
    const shot = SHOTS.find(s => s.name === name)
    if (!shot) {
      throw new Error(
        `no shot called "${name}". Shots: ${SHOTS.map(s => s.name).join(', ')}`
      )
    }
    return shot
  })
}

// The native macOS window frame at 2x, measured from real window captures. The
// soft shadow is a rounded rectangle inset 8px and moved 8px down; `SOFT_SHADOW`
// is its alpha at each pixel outside that rectangle, and `CONTACT_SHADOW` the
// darker line right against the window.
const MARGIN = { left: 46, right: 46, top: 38, bottom: 54 }
const CORNER_RADIUS = 20
const SOFT_SHADOW = [
  44, 42, 40, 39, 38, 36, 34, 33, 31, 29, 28, 26, 25, 23, 22, 20, 19, 17, 16,
  15, 14, 12, 11, 10, 9, 8, 8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1,
  1, 1, 1,
]
const CONTACT_SHADOW = [71, 29, 6]

/** Signed distance from a point to a rounded rectangle: negative inside. */
function roundedRectDistance(
  x: number,
  y: number,
  rect: { left: number; top: number; right: number; bottom: number },
  radius: number
) {
  const dx =
    Math.abs(x - (rect.left + rect.right) / 2) -
    (rect.right - rect.left) / 2 +
    radius
  const dy =
    Math.abs(y - (rect.top + rect.bottom) / 2) -
    (rect.bottom - rect.top) / 2 +
    radius
  return (
    Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) +
    Math.min(Math.max(dx, dy), 0) -
    radius
  )
}

/** Cuts a logical-pixel rectangle out of a 2x snapshot. */
export function cropSnapshot(
  snapshot: Buffer,
  [x, y, width, height]: NonNullable<Shot['crop']>
): Buffer {
  const source = PNG.sync.read(snapshot)
  const out = new PNG({ width: width * 2, height: height * 2 })
  PNG.bitblt(source, out, x * 2, y * 2, width * 2, height * 2, 0, 0)
  return PNG.sync.write(out)
}

/**
 * Gives a window snapshot the rounded corners and shadow of a native capture,
 * since the webview snapshot has neither. Returns a PNG with transparent margins.
 */
export function frameWindow(snapshot: Buffer): Buffer {
  const source = PNG.sync.read(snapshot)
  const width = source.width + MARGIN.left + MARGIN.right
  const height = source.height + MARGIN.top + MARGIN.bottom
  const out = new PNG({ width, height })
  const window = {
    left: MARGIN.left,
    top: MARGIN.top,
    right: MARGIN.left + source.width,
    bottom: MARGIN.top + source.height,
  }
  const shadowRect = {
    left: window.left + 8,
    top: window.top + 16,
    right: window.right - 8,
    bottom: window.bottom,
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const toWindow = roundedRectDistance(
        x + 0.5,
        y + 0.5,
        window,
        CORNER_RADIUS
      )
      const toShadow = roundedRectDistance(
        x + 0.5,
        y + 0.5,
        shadowRect,
        CORNER_RADIUS - 8
      )
      const coverage = Math.min(Math.max(0.5 - toWindow, 0), 1)
      const soft = (SOFT_SHADOW[Math.max(0, Math.floor(toShadow))] ?? 0) / 255
      const contact =
        toWindow > 0 ? (CONTACT_SHADOW[Math.floor(toWindow)] ?? 0) / 255 : 0
      const shadow = 1 - (1 - soft) * (1 - contact)
      const alpha = coverage + shadow * (1 - coverage)

      const to = (y * width + x) * 4
      if (coverage > 0) {
        const from = ((y - MARGIN.top) * source.width + (x - MARGIN.left)) * 4
        // The shadow under an edge pixel is black, so only the window adds colour
        for (let channel = 0; channel < 3; channel++) {
          out.data[to + channel] = Math.round(
            (source.data[from + channel]! * coverage) / alpha
          )
        }
      }
      out.data[to + 3] = Math.round(alpha * 255)
    }
  }
  return PNG.sync.write(out)
}
