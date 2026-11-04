// `bun run setup`: gets this checkout ready to work in. Safe to rerun.
//
// Everywhere: installs dependencies, creates docs/tasks-todo/temporary and the
// test vault if they're missing.
// In a git worktree it also:
//   - claims a dev slot (scripts/dev-slot.ts) and empties that slot's app data,
//     so the dev app doesn't start with the last user's preferences or recovery files
//   - clones the main checkout's Rust build (copy-on-write), so the first
//     `tauri:dev` only rebuilds the app crate instead of every dependency
//
// worktrunk runs it when it creates a worktree (.config/wt.toml).
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  type Checkout,
  checkout,
  devIdentity,
  git,
  lowestFreeSlot,
  MAX_SLOT,
  readSlotFile,
  SLOT_FILE,
  slotIdentity,
} from './dev-slot'

// Gitignored folders cloned from the main checkout when a worktree doesn't have them
const CLONED = ['src-tauri/target', '.serena']

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false
  )

function run(cmd: string[], cwd: string) {
  console.log(`$ ${cmd.join(' ')}`)
  const result = Bun.spawnSync(cmd, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (!result.success) throw new Error(`${cmd.join(' ')} failed`)
}

/** Paths of the other worktrees of this repo, main checkout included. */
function otherWorktrees(root: string): string[] {
  return git(root, 'worktree', 'list', '--porcelain')
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length))
    .filter(p => p !== root)
}

/**
 * Whether anything listens on a localhost port. Vite listens on `localhost`,
 * which on macOS is IPv6 (::1), so both addresses are tried.
 */
async function portInUse(port: number): Promise<boolean> {
  for (const hostname of ['127.0.0.1', '::1']) {
    const open = await Bun.connect({ hostname, port, socket: { data() {} } })
      .then(socket => (socket.end(), true))
      .catch(() => false)
    if (open) return true
  }
  return false
}

/**
 * Picks the lowest free slot, empties its app data, then records it in the
 * slot file. Recording it last means an interrupted run empties it again.
 */
async function claimSlot(current: Checkout) {
  const recorded = (
    await Promise.all(otherWorktrees(current.root).map(readSlotFile))
  ).filter(slot => slot !== null)
  // A removed worktree's dev app can still be running on its slot
  const running: number[] = []
  for (let slot = 1; slot <= MAX_SLOT; slot++) {
    if (recorded.includes(slot)) continue
    const { port } = await slotIdentity(slot, current)
    if (await portInUse(port)) running.push(slot)
  }
  const slot = lowestFreeSlot([...recorded, ...running])
  if (slot === null) {
    throw new Error(
      `all ${MAX_SLOT} dev slots are taken (worktrees: ${recorded.join(', ') || 'none'}, ` +
        `still running: ${running.join(', ') || 'none'}). Remove a worktree or stop its tauri:dev first`
    )
  }

  const { identifier } = await slotIdentity(slot, current)
  const dataDir = path.join(
    homedir(),
    'Library/Application Support',
    identifier
  )
  const leftovers = await readdir(dataDir).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    }
  )
  await Promise.all(
    leftovers.map(name =>
      rm(path.join(dataDir, name), { recursive: true, force: true })
    )
  )
  await writeFile(path.join(current.root, SLOT_FILE), `${slot}\n`)
}

const current = checkout()
const { root } = current

run(['bun', 'install'], root)
await mkdir(path.join(root, 'docs/tasks-todo/temporary'), { recursive: true })
if (!(await exists(path.join(root, 'temp-dummy-astro-project')))) {
  run(['bun', 'run', 'reset:testdata'], root)
}

if (!current.isMain) {
  if ((await readSlotFile(root)) === null) await claimSlot(current)

  for (const dir of CLONED) {
    const from = path.join(current.mainRoot, dir)
    const to = path.join(root, dir)
    if ((await exists(to)) || !(await exists(from))) continue
    // -c clones with APFS clonefile, so the copy shares disk until files change
    run(['cp', '-cR', from, to], root)
  }
}

const identity = await devIdentity(current)
console.log(
  `\nReady: slot ${identity.slot}, ${identity.productName} on port ${identity.port}. ` +
    'Start it with `bun run tauri:dev`.'
)
