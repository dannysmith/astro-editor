// Dev slots let several checkouts of this repo (git worktrees) each run their own
// dev app at once. The main checkout is slot 0 and has the identity in
// src-tauri/tauri.dev.conf.json. A worktree claims a slot from 1 to MAX_SLOT when
// `bun run setup` runs there, and keeps it in dev-slot.local at its root. The slot
// decides the dev app's identifier (and so its data, logs, agent bridge file and
// single-instance socket), product name, Vite port and window title.
//
// scripts/app.ts and scripts/setup.ts import this. scripts/tauri-dev.sh runs it
// directly to get shell variables for launching this checkout's dev app.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const MAX_SLOT = 4
export const SLOT_FILE = 'dev-slot.local'
const BASE_PORT = 1420

export type Checkout = {
  root: string
  /** The main checkout, where `.git` lives */
  mainRoot: string
  isMain: boolean
  /** The current branch, or "detached" */
  branch: string
}

export type DevIdentity = {
  slot: number
  identifier: string
  productName: string
  port: number
  title: string
}

/** Runs git in `cwd` and returns its trimmed output. Throws if it fails. */
export function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd })
  if (!result.success) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`)
  }
  return result.stdout.toString().trim()
}

/** The checkout this script lives in. */
export function checkout(): Checkout {
  const cwd = path.join(import.meta.dir, '..')
  const gitDir = git(cwd, 'rev-parse', '--path-format=absolute', '--git-dir')
  const commonDir = git(
    cwd,
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir'
  )
  return {
    root: git(cwd, 'rev-parse', '--show-toplevel'),
    mainRoot: path.dirname(commonDir),
    isMain: gitDir === commonDir,
    branch: git(cwd, 'branch', '--show-current') || 'detached',
  }
}

/** A slot file's slot: 1 to MAX_SLOT, or null for anything else. */
export function parseSlot(contents: string): number | null {
  const slot = Number(contents.trim())
  return Number.isInteger(slot) && slot >= 1 && slot <= MAX_SLOT ? slot : null
}

/**
 * The slot recorded in a worktree, or null if setup hasn't claimed a valid one.
 * Throws if the file exists but can't be read, rather than treat its slot as free.
 */
export async function readSlotFile(root: string): Promise<number | null> {
  const contents = await readFile(path.join(root, SLOT_FILE), 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    }
  )
  return contents === null ? null : parseSlot(contents)
}

/** The lowest slot from 1 to MAX_SLOT that isn't taken, or null if all are. */
export function lowestFreeSlot(taken: number[]): number | null {
  for (let slot = 1; slot <= MAX_SLOT; slot++) {
    if (!taken.includes(slot)) return slot
  }
  return null
}

/** The dev app identity for a slot, built on the slot 0 identity. */
export function identityFor(
  slot: number,
  base: { identifier: string; productName: string },
  branch: string
): DevIdentity {
  return {
    slot,
    identifier: slot === 0 ? base.identifier : `${base.identifier}${slot}`,
    productName: slot === 0 ? base.productName : `${base.productName} ${slot}`,
    port: BASE_PORT + 10 * slot,
    title: `Astro Editor (Dev${slot === 0 ? '' : ` ${slot}`} · ${branch})`,
  }
}

/** The dev identity a slot has in this checkout. */
export async function slotIdentity(
  slot: number,
  current: Checkout
): Promise<DevIdentity> {
  const base = (await Bun.file(
    path.join(current.root, 'src-tauri/tauri.dev.conf.json')
  ).json()) as { identifier: string; productName: string }
  return identityFor(slot, base, current.branch)
}

/** This checkout's dev identity. Throws in a worktree that hasn't been set up. */
export async function devIdentity(
  current = checkout()
): Promise<DevIdentity & Checkout> {
  const slot = current.isMain ? 0 : await readSlotFile(current.root)
  if (slot === null) {
    throw new Error(
      `this worktree has no dev slot yet. Run \`bun run setup\` in ${current.root}`
    )
  }
  return { ...(await slotIdentity(slot, current)), ...current }
}

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`

// For scripts/tauri-dev.sh, which evals the output
if (import.meta.main) {
  const identity = await devIdentity().catch((error: Error) => {
    console.error(`tauri:dev: ${error.message}`)
    process.exit(1)
  })
  const overlay = JSON.stringify({
    identifier: identity.identifier,
    productName: identity.productName,
    build: { devUrl: `http://localhost:${identity.port}` },
  })
  console.log(
    [
      `DEV_IDENTIFIER=${shellQuote(identity.identifier)}`,
      `DEV_OVERLAY=${shellQuote(overlay)}`,
      `export ASTRO_EDITOR_DEV_PORT=${identity.port}`,
      `export ASTRO_EDITOR_DEV_TITLE=${shellQuote(identity.title)}`,
    ].join('\n')
  )
}
