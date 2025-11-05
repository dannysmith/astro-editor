import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getOrCreateTelemetryUuid, sendTelemetryEvent } from './telemetry'

const mockInvoke = vi.fn()
const mockFetch = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args) as Promise<unknown>,
}))

globalThis.fetch = mockFetch as never

describe('telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('getOrCreateTelemetryUuid', () => {
    it('should return existing UUID from file', async () => {
      mockInvoke.mockResolvedValueOnce(
        JSON.stringify({
          uuid: 'existing-uuid',
          created_at: '2025-01-01T00:00:00Z',
        })
      )

      const uuid = await getOrCreateTelemetryUuid()

      expect(uuid).toBe('existing-uuid')
      expect(mockInvoke).toHaveBeenCalledWith('read_app_data_file', {
        filePath: 'telemetry.json',
      })
      expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('should create new UUID when file does not exist', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File not found'))
      mockInvoke.mockResolvedValueOnce(undefined)

      const uuid = await getOrCreateTelemetryUuid()

      expect(uuid).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(mockInvoke).toHaveBeenCalledWith('read_app_data_file', {
        filePath: 'telemetry.json',
      })
      expect(mockInvoke).toHaveBeenCalledWith('write_app_data_file', {
        filePath: 'telemetry.json',
        content: expect.stringContaining(
          '550e8400-e29b-41d4-a716-446655440000'
        ) as string,
      })
    })

    it('should persist UUID with created_at timestamp', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File not found'))
      mockInvoke.mockResolvedValueOnce(undefined)

      await getOrCreateTelemetryUuid()

      const writeCall = mockInvoke.mock.calls.find(
        call => call[0] === 'write_app_data_file'
      ) as [string, { filePath: string; content: string }] | undefined
      expect(writeCall).toBeDefined()

      if (!writeCall) throw new Error('write call not found')

      const content = JSON.parse(writeCall[1].content) as {
        uuid: string
        created_at: string
      }
      expect(content).toHaveProperty(
        'uuid',
        '550e8400-e29b-41d4-a716-446655440000'
      )
      expect(content).toHaveProperty('created_at')
      expect(new Date(content.created_at).toISOString()).toBe(
        content.created_at
      )
    })
  })

  describe('sendTelemetryEvent', () => {
    beforeEach(() => {
      mockInvoke.mockResolvedValue(
        JSON.stringify({
          uuid: 'test-uuid',
          created_at: '2025-01-01T00:00:00Z',
        })
      )
      mockFetch.mockResolvedValue({ ok: true })
    })

    it('should send telemetry event with correct payload', async () => {
      await sendTelemetryEvent('0.1.32')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://updateserver.dny.li/event',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('0.1.32') as string,
        })
      )

      const callArgs = mockFetch.mock.calls[0] as
        | [string, { body: string }]
        | undefined
      if (!callArgs) throw new Error('fetch not called')

      const payload = JSON.parse(callArgs[1].body) as {
        appId: string
        uuid: string
        version: string
        event: string
        platform: string
        timestamp: string
      }

      expect(payload).toEqual({
        appId: 'astro-editor',
        uuid: 'test-uuid',
        version: '0.1.32',
        event: 'update_check',
        platform: 'macos',
        timestamp: expect.any(String) as string,
      })
    })

    it('should include abort signal with 5s timeout', async () => {
      await sendTelemetryEvent('0.1.32')

      const callArgs = mockFetch.mock.calls[0] as
        | [string, { signal: AbortSignal }]
        | undefined
      if (!callArgs) throw new Error('fetch not called')

      expect(callArgs[1]).toHaveProperty('signal')
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal)
    })

    it('should fail silently when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(sendTelemetryEvent('0.1.32')).resolves.toBeUndefined()
    })

    it('should fail silently when UUID generation fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Cannot write file'))

      await expect(sendTelemetryEvent('0.1.32')).resolves.toBeUndefined()
    })

    it('should handle abort timeout', async () => {
      vi.useFakeTimers()

      let rejectFetch: (reason: Error) => void
      mockFetch.mockReturnValue(
        new Promise((_, reject) => {
          rejectFetch = reject
        })
      )

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const promise = sendTelemetryEvent('0.1.32')

      vi.advanceTimersByTime(5000)

      rejectFetch!(new Error('AbortError'))

      await promise

      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      vi.useRealTimers()
    })
  })
})
