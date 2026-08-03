import { describe, it, expect } from 'vitest'
import { settingsPatchSchema } from '../../shared/schemas/settings'

describe('settingsPatchSchema', () => {
  it('принимает ISO-строку дедлайна', () => {
    const result = settingsPatchSchema.safeParse({ rsvpDeadlineAt: '2026-08-10T21:00' })
    expect(result.success).toBe(true)
  })

  it('принимает null (снять дедлайн)', () => {
    const result = settingsPatchSchema.safeParse({ rsvpDeadlineAt: null })
    expect(result.success).toBe(true)
  })

  it('отклоняет пустую строку', () => {
    const result = settingsPatchSchema.safeParse({ rsvpDeadlineAt: '' })
    expect(result.success).toBe(false)
  })

  it('отклоняет отсутствие поля', () => {
    const result = settingsPatchSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
