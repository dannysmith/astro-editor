import type { Mock } from 'vitest'

declare global {
  var mockTauri: {
    invoke: Mock<(cmd: string, args?: unknown) => Promise<unknown>>
    listen: Mock<
      (
        event: string,
        handler: (payload: unknown) => void
      ) => Promise<() => void>
    >
    reset: () => void
  }
}
