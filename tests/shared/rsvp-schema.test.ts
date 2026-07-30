import { describe, it, expect } from 'vitest'
import { rsvpSchema } from '../../shared/schemas/rsvp'

describe('rsvpSchema', () => {
  it('accepts a valid payload', () => {
    const result = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: '',
      drinks: ['wine'],
      companions: [{ fio: 'Петров Пётр', drinks: ['beer'] }],
      website: ''
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty fio', () => {
    const result = rsvpSchema.safeParse({ fio: '', drinks: [], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('rejects more than 3 companions', () => {
    const companions = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = rsvpSchema.safeParse({ fio: 'Тест', drinks: [], companions, website: '' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown drink option', () => {
    const result = rsvpSchema.safeParse({ fio: 'Тест', drinks: ['vodka-cocktail'], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('allows website field to be non-empty (honeypot handled downstream, not by schema)', () => {
    const result = rsvpSchema.safeParse({ fio: 'Бот', drinks: [], companions: [], website: 'spam' })
    expect(result.success).toBe(true)
  })
})
