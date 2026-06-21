/**
 * Deep-link helpers for the `astro-editor://open?path=...` URL scheme.
 *
 * Pure parsing/matching logic lives here (testable, no Tauri/store deps). The
 * cold-start coordination below lets an incoming launch URL take precedence over
 * the persisted-project auto-load (see `loadPersistedProject` in projectStore).
 */

/** The custom URL scheme this app registers (matches tauri.conf.json). */
const SCHEME = 'astro-editor:'

/** The only supported action/host for now. */
const OPEN_ACTION = 'open'

/**
 * Parses an `astro-editor://open?path=<encoded-path>` URL and returns the decoded
 * absolute file path, or `null` if the URL isn't a valid open-file deep link.
 */
export function parseDeepLinkPath(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== SCHEME) return null
  if (parsed.host !== OPEN_ACTION) return null

  // searchParams already percent-decodes the value.
  const path = parsed.searchParams.get('path')
  if (!path || path.trim() === '') return null

  return path
}

function normalizeForCompare(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Returns the project path (from the given list of known project paths) that owns
 * `filePath`, i.e. is an ancestor of it. The most specific (longest) match wins.
 * Comparison is case-insensitive and separator-agnostic to tolerate
 * macOS/Windows path quirks; the Rust layer enforces real containment.
 *
 * Returns the original (un-normalized) project path so it can be passed to
 * `setProject`, or `null` if no known project owns the file.
 */
export function findOwningProjectPath(
  projectPaths: string[],
  filePath: string
): string | null {
  const file = normalizeForCompare(filePath).toLowerCase()

  let best: string | null = null
  let bestLength = -1

  for (const projectPath of projectPaths) {
    const parent = normalizeForCompare(projectPath)
    const parentCmp = parent.toLowerCase()

    const isInside = file === parentCmp || file.startsWith(`${parentCmp}/`)
    if (isInside && parent.length > bestLength) {
      best = projectPath
      bestLength = parent.length
    }
  }

  return best
}

// --- Cold-start coordination -------------------------------------------------

let resolveStartupClaim: ((claimed: boolean) => void) | null = null
const startupClaim = new Promise<boolean>(resolve => {
  resolveStartupClaim = resolve
})

/**
 * Called once by the deep-link hook after it has checked for a launch URL.
 * `claimed` is true when the app was started by a deep link (so the deep-link
 * handler — not the persisted-project loader — should decide which project opens).
 */
export function resolveDeepLinkStartup(claimed: boolean): void {
  resolveStartupClaim?.(claimed)
  resolveStartupClaim = null
}

/**
 * Resolves to `true` if a deep link claimed app startup, `false` otherwise.
 * Bounded by `timeoutMs` so the persisted-project loader never hangs if the
 * deep-link hook didn't run (e.g. plugin unavailable).
 */
export function wasStartupClaimedByDeepLink(
  timeoutMs = 2000
): Promise<boolean> {
  const fallback = new Promise<boolean>(resolve => {
    setTimeout(() => resolve(false), timeoutMs)
  })
  return Promise.race([startupClaim, fallback])
}
