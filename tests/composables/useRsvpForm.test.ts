import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRsvpForm } from '../../app/composables/useRsvpForm'

describe('useRsvpForm', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1 }))
  })

  it('adds companions up to a maximum of 3', () => {
    const { form, addCompanion } = useRsvpForm()
    addCompanion(); addCompanion(); addCompanion(); addCompanion()
    expect(form.companions).toHaveLength(3)
  })

  it('removes a companion by index', () => {
    const { form, addCompanion, removeCompanion } = useRsvpForm()
    addCompanion(); addCompanion()
    removeCompanion(0)
    expect(form.companions).toHaveLength(1)
  })

  it('buildPayload returns null and sets an error when fio is missing', () => {
    const { buildPayload, errors } = useRsvpForm()
    const payload = buildPayload()
    expect(payload).toBeNull()
    expect(errors.message).toBeTruthy()
  })

  it('submit calls $fetch with a valid payload', async () => {
    const { form, submit } = useRsvpForm()
    form.fio = 'Иванов Иван'
    const ok = await submit()
    expect(ok).toBe(true)
    expect($fetch).toHaveBeenCalledWith('/api/rsvp', expect.objectContaining({ method: 'POST' }))
  })
})
