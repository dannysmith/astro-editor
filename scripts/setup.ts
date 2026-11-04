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
  checkout,
  devIdentity,
  lowestFreeSlot,
  MAX_SLOT,
  readSlotFile,
  SLOT_FILE,
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
  const result = Bun.spawnSync(['git', 'worktree', 'list', '--porcelain'], {
    cwd: root,
  })
  return result.stdout
    .toString()
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length))
    .filter(p => p !== root)
}

async function claimSlot(root: string): Promise<number> {
  const taken = (
    await Promise.all(otherWorktrees(root).map(readSlotFile))
  ).filter(slot => slot !== null)
  const slot = lowestFreeSlot(taken)
  if (slot === null) {
    throw new Error(
      `all ${MAX_SLOT} dev slots are taken (${taken.join(', ')}). Remove a worktree first`
    )
  }
  await writeFile(path.join(root, SLOT_FILE), `${slot}\n`)
  return slot
}

const current = checkout()
const { root } = current

run(['bun', 'install'], root)
await mkdir(path.join(root, 'docs/tasks-todo/temporary'), { recursive: true })
if (!(await exists(path.join(root, 'temp-dummy-astro-project')))) {
  run(['bun', 'run', 'reset:testdata'], root)
}

if (!current.isMain) {
  if ((await readSlotFile(root)) === null) {
    await claimSlot(root)
    const { identifier } = await devIdentity(current)
    const dataDir = path.join(
      homedir(),
      'Library/Application Support',
      identifier
    )
    const leftovers = await readdir(dataDir).catch(() => [])
    await Promise.all(
      leftovers.map(name =>
        rm(path.join(dataDir, name), { recursive: true, force: true })
      )
    )
  }

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
