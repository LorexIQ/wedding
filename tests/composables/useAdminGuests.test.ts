import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminGuests } from '../../app/composables/useAdminGuests'

describe('useAdminGuests', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([
      { id: 1, fio: 'Иванов Иван', phone: null, comment: null, drinks: ['red_dry'], companions: [] }
    ]))
  })

  it('fetchGuests populates the list', async () => {
    const { guestsList, fetchGuests } = useAdminGuests()
    await fetchGuests()
    expect(guestsList.value).toHaveLength(1)
    expect(guestsList.value[0].fio).toBe('Иванов Иван')
  })

  it('removeGuest removes the item from the local list', async () => {
    const { guestsList, fetchGuests, removeGuest } = useAdminGuests()
    await fetchGuests()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ ok: true }))
    await removeGuest(1)
    expect(guestsList.value).toHaveLength(0)
  })

  it('patchGuest merges the update into the local list', async () => {
    const { guestsList, fetchGuests, patchGuest } = useAdminGuests()
    await fetchGuests()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1, comment: 'Аллергия' }))
    await patchGuest(1, { comment: 'Аллергия' })
    expect(guestsList.value[0].comment).toBe('Аллергия')
  })

  it('createGuestInvite добавляет созданного гостя в список', async () => {
    const { guestsList, createGuestInvite } = useAdminGuests()
    // This mock must mirror the REAL POST /api/admin/guests response shape (see
    // server/api/admin/guests/index.post.ts) — including `companions: []` — because
    // app/pages/admin/index.vue renders `guest.companions.map(...)` for every row,
    // including a freshly-created one. A mock missing `companions` would let this test
    // pass while the real endpoint crashed the admin table on the first invite creation.
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      id: 2, fio: null, phone: null, comment: null, drinks: [],
      inviteCode: 'ABC1234567', submitted: false, envelopeOpened: false, companions: []
    }))

    const created = await createGuestInvite({})
    expect(created.inviteCode).toBe('ABC1234567')
    expect(guestsList.value).toHaveLength(1)
    expect(guestsList.value[0].inviteCode).toBe('ABC1234567')
    // Guard against the crash: guest.companions.map(...) in admin/index.vue requires
    // this to be an array, not undefined.
    expect(guestsList.value[0].companions).toEqual([])
  })
})
