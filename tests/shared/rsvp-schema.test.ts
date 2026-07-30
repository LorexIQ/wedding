import { describe, it, expect } from 'vitest'
import { rsvpSchema, guestPatchSchema } from '../../shared/schemas/rsvp'
import { isDrinkSetValid } from '../../shared/constants/drinks'

describe('rsvpSchema', () => {
  it('accepts a valid payload', () => {
    const result = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: '',
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
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

describe('взаимоисключение «Не пью»', () => {
  it('isDrinkSetValid пропускает только алкоголь', () => {
    expect(isDrinkSetValid(['red_dry', 'vodka'])).toBe(true)
  })

  it('isDrinkSetValid пропускает одинокое «не пью»', () => {
    expect(isDrinkSetValid(['none'])).toBe(true)
  })

  it('isDrinkSetValid пропускает пустой набор', () => {
    expect(isDrinkSetValid([])).toBe(true)
  })

  it('isDrinkSetValid отклоняет «не пью» вместе с алкоголем', () => {
    expect(isDrinkSetValid(['none', 'vodka'])).toBe(false)
  })

  it('rsvpSchema отклоняет «не пью» вместе с алкоголем у гостя', () => {
    const parsed = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      drinks: ['none', 'red_dry'],
      companions: [],
      website: ''
    })
    expect(parsed.success).toBe(false)
  })

  it('rsvpSchema отклоняет такой набор и у спутника', () => {
    const parsed = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      drinks: [],
      companions: [{ fio: 'Петров Пётр', drinks: ['none', 'vodka'] }],
      website: ''
    })
    expect(parsed.success).toBe(false)
  })

  it('guestPatchSchema отклоняет такой набор при правке из админки', () => {
    const parsed = guestPatchSchema.safeParse({ drinks: ['none', 'brandy'] })
    expect(parsed.success).toBe(false)
  })
})
