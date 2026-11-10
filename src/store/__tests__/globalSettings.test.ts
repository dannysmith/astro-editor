import { describe, it, expect, beforeEach, vi } from 'vitest'
import { commands, type GlobalSettings } from '@/lib/bindings'
import { useProjectStore } from '../projectStore'

vi.mock('@/lib/bindings', () => ({
  commands: { saveGlobalSettings: vi.fn() },
}))

const settings = {
  general: { ideCommand: 'code', autoSaveDelay: 2 },
  appearance: { headingColor: { light: '#111111', dark: '#eeeeee' } },
  version: 2,
} as unknown as GlobalSettings

const save = vi.mocked(commands.saveGlobalSettings)

/** Saves that wait until told to finish, each with its own outcome */
function heldSaves() {
  const finishers: ((ok: boolean) => void)[] = []
  save.mockImplementation(
    () =>
      new Promise(resolve => {
        finishers.push(ok =>
          resolve(
            ok
              ? { status: 'ok', data: null }
              : { status: 'error', error: 'disk full' }
          )
        )
      })
  )
  return finishers
}

const general = () =>
  useProjectStore.getState().globalSettings?.general as unknown as Record<
    string,
    unknown
  >

describe('updateGlobalSettings', () => {
  beforeEach(() => {
    save.mockReset()
    useProjectStore.setState({ globalSettings: settings })
  })

  it('keeps both of two overlapping changes, and saves them in order', async () => {
    const finish = heldSaves()
    const { updateGlobalSettings } = useProjectStore.getState()

    const first = updateGlobalSettings({ general: { ideCommand: 'cursor' } })
    const second = updateGlobalSettings({ general: { autoSaveDelay: 5 } })
    expect(general()).toMatchObject({ ideCommand: 'cursor', autoSaveDelay: 5 })

    await vi.waitFor(() => expect(finish).toHaveLength(1))
    finish[0]?.(true)
    await vi.waitFor(() => expect(finish).toHaveLength(2))
    finish[1]?.(true)
    await Promise.all([first, second])

    expect(save.mock.calls.at(-1)?.[0].general).toMatchObject({
      ideCommand: 'cursor',
      autoSaveDelay: 5,
    })
  })

  it('rolls back a failed change', async () => {
    const finish = heldSaves()
    const { updateGlobalSettings } = useProjectStore.getState()

    const failing = updateGlobalSettings({ general: { ideCommand: 'cursor' } })
    await vi.waitFor(() => expect(finish).toHaveLength(1))
    finish[0]?.(false)
    await failing

    expect(general()).toMatchObject({ ideCommand: 'code' })
  })
})
