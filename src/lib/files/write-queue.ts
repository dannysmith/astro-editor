/**
 * The latest save's write, while it's under way. Saves can overlap (Cmd+S
 * during an auto-save, or the forced save while typing on a slow disk), so
 * each write waits for the one before and they land in the order they were
 * asked for.
 */
let writeUnderWay: Promise<void> | null = null

/** Runs `write` once every earlier write has finished, or at once if none is under way */
export function queueWrite<T>(write: () => Promise<T>): Promise<T> {
  const result = writeUnderWay ? writeUnderWay.then(write) : write()
  const settled = result.then(
    () => undefined,
    () => undefined
  )
  writeUnderWay = settled
  void settled.then(() => {
    if (writeUnderWay === settled) writeUnderWay = null
  })
  return result
}

/** Resolves when the writes queued so far have finished, whether or not they succeeded */
export function writesFinished(): Promise<void> {
  return writeUnderWay ?? Promise.resolve()
}
