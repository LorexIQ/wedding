import { ref } from 'vue'

export function useAdminSettings() {
  const deadline = ref<number | null>(null)
  const loading = ref(false)

  async function fetchSettings() {
    const requestFetch = useRequestFetch()
    loading.value = true
    try {
      const result = await requestFetch<{ rsvpDeadlineAt: number | null }>('/api/admin/settings')
      deadline.value = result.rsvpDeadlineAt
    } finally {
      loading.value = false
    }
  }

  async function patchSettings(rsvpDeadlineAt: string | null) {
    const requestFetch = useRequestFetch()
    const result = await requestFetch<{ rsvpDeadlineAt: number | null }>('/api/admin/settings', {
      method: 'PATCH',
      body: { rsvpDeadlineAt }
    })
    deadline.value = result.rsvpDeadlineAt
  }

  return { deadline, loading, fetchSettings, patchSettings }
}
