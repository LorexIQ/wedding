import { reactive } from 'vue'
import { rsvpSchema, type RsvpInput } from '#shared/schemas/rsvp'
import { DRINK_OPTIONS } from '#shared/constants/drinks'

export interface CompanionForm {
  fio: string
  drinks: string[]
}

export function useRsvpForm() {
  const form = reactive({
    fio: '',
    phone: '',
    comment: '',
    drinks: [] as string[],
    companions: [] as CompanionForm[],
    website: ''
  })

  const errors = reactive<{ message?: string }>({})
  const submitted = reactive({ success: false, pending: false })

  function addCompanion() {
    if (form.companions.length >= 3) return
    form.companions.push({ fio: '', drinks: [] })
  }

  function removeCompanion(index: number) {
    form.companions.splice(index, 1)
  }

  function buildPayload(): RsvpInput | null {
    const parsed = rsvpSchema.safeParse(form)
    if (!parsed.success) {
      errors.message = parsed.error.issues[0]?.message
      return null
    }
    errors.message = undefined
    return parsed.data
  }

  async function submit() {
    const payload = buildPayload()
    if (!payload) return false

    submitted.pending = true
    try {
      await $fetch('/api/rsvp', { method: 'POST', body: payload })
      submitted.success = true
      return true
    } catch (e: any) {
      errors.message = e?.data?.statusMessage ?? 'Что-то пошло не так, попробуйте ещё раз'
      return false
    } finally {
      submitted.pending = false
    }
  }

  return { form, errors, submitted, addCompanion, removeCompanion, buildPayload, submit, DRINK_OPTIONS }
}
