import { ref } from 'vue'

export interface GuestRecord {
  id: number
  fio: string | null
  phone: string | null
  comment: string | null
  drinks: string[]
  inviteCode: string | null
  submitted: boolean
  envelopeOpened: boolean
  attending: boolean | null
  allowCompanions: boolean
  companions: { id: number, fio: string, drinks: string[] }[]
}

export interface GuestCreateInput {
  fio?: string
  phone?: string
  comment?: string
  drinks?: string[]
  attending?: boolean | null
  allowCompanions?: boolean
}

export function useAdminGuests() {
  const guestsList = ref<GuestRecord[]>([])
  const loading = ref(false)

  async function fetchGuests() {
    const requestFetch = useRequestFetch()
    loading.value = true
    try {
      guestsList.value = await requestFetch<GuestRecord[]>('/api/admin/guests')
    } finally {
      loading.value = false
    }
  }

  async function createGuestInvite(input: GuestCreateInput) {
    const requestFetch = useRequestFetch()
    // The server now returns a full GuestRecord (including companions: []), matching
    // listGuests()'s shape, so the fetch generic alone is enough — no extra cast needed.
    const created = await requestFetch<GuestRecord>('/api/admin/guests', { method: 'POST', body: input })
    guestsList.value.push(created)
    return created
  }

  async function patchGuest(id: number, patch: Partial<GuestRecord>) {
    const requestFetch = useRequestFetch()
    const updated = await requestFetch(`/api/admin/guests/${id}`, { method: 'PATCH', body: patch }) as unknown as Omit<GuestRecord, 'companions'>
    const index = guestsList.value.findIndex((guest) => guest.id === id)
    const current = guestsList.value[index]
    if (index !== -1 && current) {
      guestsList.value[index] = { ...current, ...updated, companions: current.companions }
    }
  }

  async function removeGuest(id: number) {
    const requestFetch = useRequestFetch()
    await requestFetch(`/api/admin/guests/${id}`, { method: 'DELETE' })
    guestsList.value = guestsList.value.filter((guest) => guest.id !== id)
  }

  return { guestsList, loading, fetchGuests, createGuestInvite, patchGuest, removeGuest }
}
