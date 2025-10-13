/**
 * Drop Coordinator - Prevents conflicts between multiple drop handlers
 *
 * When multiple components listen to Tauri's 'tauri://drag-drop' event,
 * they all receive the event simultaneously. This coordinator allows
 * components to "claim" a drop, preventing other handlers from processing it.
 *
 * Usage:
 * ```typescript
 * // In ImageField (or other specific drop zone)
 * const dropCoordinator = useDropCoordinator()
 * if (dropCoordinator.shouldHandle()) {
 *   dropCoordinator.claim()
 *   // Process the drop
 * }
 *
 * // In global handler (like editor)
 * if (!dropCoordinator.isClaimed()) {
 *   // Process the drop
 * }
 * ```
 */

let claimedDropTimestamp: number | null = null
const CLAIM_DURATION_MS = 100 // How long a claim lasts

/**
 * Claim the current drop event.
 * This prevents other handlers from processing this drop.
 */
export function claimDrop(): void {
  claimedDropTimestamp = Date.now()
}

/**
 * Check if the current drop has been claimed by another handler.
 * Claims expire after CLAIM_DURATION_MS to prevent stale claims.
 */
export function isDropClaimed(): boolean {
  if (claimedDropTimestamp === null) {
    return false
  }

  const elapsed = Date.now() - claimedDropTimestamp
  if (elapsed > CLAIM_DURATION_MS) {
    // Claim has expired, clear it
    claimedDropTimestamp = null
    return false
  }

  return true
}

/**
 * Clear the current drop claim.
 * Usually not needed as claims auto-expire, but can be used for cleanup.
 */
export function clearDropClaim(): void {
  claimedDropTimestamp = null
}
