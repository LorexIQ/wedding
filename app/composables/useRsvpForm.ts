import { reactive } from 'vue'
import { rsvpSchema, type RsvpInput } from '#shared/schemas/rsvp'
import { DRINK_OPTIONS, normalizeDrinks } from '#shared/constants/drinks'

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

  const errors = reactive<{ message?: string, fields: Record<string, string> }>({ fields: {} })
  const submitted = reactive({ success: false, pending: false })

  function addCompanion() {
    if (form.companions.length >= 3) return
    form.companions.push({ fio: '', drinks: [] })
  }

  function removeCompanion(index: number) {
    form.companions.splice(index, 1)
  }

  function toggleDrink(target: { drinks: string[] }, option: string) {
    target.drinks = normalizeDrinks(target.drinks, option)
  }

  function buildPayload(): RsvpInput | null {
    const parsed = rsvpSchema.safeParse(form)

    // Zod отдаёт путь до поля (['companions', 0, 'fio']) — склеиваем его
    // в ключ, по которому шаблон найдёт свою подпись под инпутом.
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!fields[key]) fields[key] = issue.message
      }
      errors.fields = fields
      errors.message = 'Проверьте отмеченные поля'
      return null
    }

    errors.fields = {}
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

  return { form, errors, submitted, addCompanion, removeCompanion, toggleDrink, buildPayload, submit, DRINK_OPTIONS }
}
