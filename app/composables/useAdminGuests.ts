import { ref } from 'vue'

export interface GuestRecord {
  id: number
  fio: string
  phone: string | null
  comment: string | null
  drinks: string[]
  companions: { id: number, fio: string, drinks: string[] }[]
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

  async function patchGuest(id: number, patch: Partial<GuestRecord>) {
    const requestFetch = useRequestFetch()
    const updated = await requestFetch(`/api/admin/guests/${id}`, { method: 'PATCH', body: patch })
    const index = guestsList.value.findIndex((guest) => guest.id === id)
    if (index !== -1) guestsList.value[index] = { ...guestsList.value[index], ...updated }
  }

  async function removeGuest(id: number) {
    const requestFetch = useRequestFetch()
    await requestFetch(`/api/admin/guests/${id}`, { method: 'DELETE' })
    guestsList.value = guestsList.value.filter((guest) => guest.id !== id)
  }

  return { guestsList, loading, fetchGuests, patchGuest, removeGuest }
}
