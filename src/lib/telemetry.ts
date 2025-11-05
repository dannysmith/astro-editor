import { invoke } from '@tauri-apps/api/core'

interface TelemetryData {
  uuid: string
  created_at: string
}

interface TelemetryPayload {
  appId: string
  uuid: string
  version: string
  event: string
  platform: string
  timestamp: string
}

/**
 * Gets or creates a UUID for anonymous telemetry tracking.
 * The UUID is stored in the app data directory and persists across sessions.
 */
export async function getOrCreateTelemetryUuid(): Promise<string> {
  try {
    const content = await invoke<string>('read_app_data_file', {
      filePath: 'telemetry.json',
    })
    const data = JSON.parse(content) as TelemetryData
    return data.uuid
  } catch {
    const uuid = crypto.randomUUID()
    const data: TelemetryData = {
      uuid,
      created_at: new Date().toISOString(),
    }
    await invoke('write_app_data_file', {
      filePath: 'telemetry.json',
      content: JSON.stringify(data, null, 2),
    })
    return uuid
  }
}

/**
 * Sends a telemetry event to the update server.
 * Fails silently if the request fails - this should never block the user.
 *
 * @param version - The current app version
 */
export async function sendTelemetryEvent(version: string): Promise<void> {
  try {
    const uuid = await getOrCreateTelemetryUuid()

    const payload: TelemetryPayload = {
      appId: 'astro-editor',
      uuid,
      version,
      event: 'update_check',
      platform: 'macos',
      timestamp: new Date().toISOString(),
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      await fetch('https://updateserver.dny.li/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Telemetry event failed:', error)
  }
}
