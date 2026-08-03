import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminSettings } from '../../app/composables/useAdminSettings'

describe('useAdminSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rsvpDeadlineAt: 1786000000000 }))
  })

  it('fetchSettings populates deadline', async () => {
    const { deadline, fetchSettings } = useAdminSettings()
    await fetchSettings()
    expect(deadline.value).toBe(1786000000000)
  })

  it('patchSettings updates deadline from the response', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rsvpDeadlineAt: null }))
    const { deadline, patchSettings } = useAdminSettings()
    await patchSettings(null)
    expect(deadline.value).toBeNull()
  })
})
