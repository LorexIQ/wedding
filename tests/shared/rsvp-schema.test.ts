import { describe, it, expect } from 'vitest'
import { rsvpSchema, guestPatchSchema, guestCreateSchema } from '../../shared/schemas/rsvp'
import { isDrinkSetValid } from '../../shared/constants/drinks'

describe('rsvpSchema', () => {
  it('accepts a valid payload', () => {
    const result = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: '',
      attending: true,
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
      website: ''
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty fio', () => {
    const result = rsvpSchema.safeParse({ fio: '', attending: true, drinks: [], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('rejects more than 3 companions', () => {
    const companions = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = rsvpSchema.safeParse({ fio: 'Тест', attending: true, drinks: [], companions, website: '' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown drink option', () => {
    const result = rsvpSchema.safeParse({ fio: 'Тест', attending: true, drinks: ['vodka-cocktail'], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('allows website field to be non-empty (honeypot handled downstream, not by schema)', () => {
    const result = rsvpSchema.safeParse({ fio: 'Бот', attending: true, drinks: [], companions: [], website: 'spam' })
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
      attending: true,
      drinks: ['none', 'red_dry'],
      companions: [],
      website: ''
    })
    expect(parsed.success).toBe(false)
  })

  it('rsvpSchema отклоняет такой набор и у спутника', () => {
    const parsed = rsvpSchema.safeParse({
      fio: 'Иванов Иван',
      attending: true,
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

describe('rsvpSchema — новое поле attending', () => {
  it('requires attending', () => {
    const result = rsvpSchema.safeParse({ fio: 'Тест', drinks: [], companions: [], website: '' })
    expect(result.success).toBe(false)
  })

  it('accepts attending: false with empty drinks/companions', () => {
    const result = rsvpSchema.safeParse({
      fio: 'Тест', attending: false, drinks: [], companions: [], website: ''
    })
    expect(result.success).toBe(true)
  })

  it('rejects attending: null with the Russian message, not Zod\'s English default', () => {
    const result = rsvpSchema.safeParse({ fio: 'Тест', attending: null, drinks: [], companions: [], website: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Укажите, придёте ли вы')
    }
  })
})

describe('guestCreateSchema (POST /api/admin/guests — создание инвайта)', () => {
  it('принимает полностью пустой объект — все поля опциональны', () => {
    const result = guestCreateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('принимает частичное заполнение', () => {
    const result = guestCreateSchema.safeParse({ fio: 'Иванов Иван' })
    expect(result.success).toBe(true)
  })

  it('отклоняет несовместимый набор напитков', () => {
    const result = guestCreateSchema.safeParse({ drinks: ['none', 'vodka'] })
    expect(result.success).toBe(false)
  })

  it('отклоняет неизвестный ключ', () => {
    const result = guestCreateSchema.safeParse({ id: 999 })
    expect(result.success).toBe(false)
  })
})

describe('guestPatchSchema — новые поля fio/submitted/envelopeOpened', () => {
  it('принимает fio отдельно от остальных полей', () => {
    const result = guestPatchSchema.safeParse({ fio: 'Иванов Иван' })
    expect(result.success).toBe(true)
  })

  it('принимает submitted и envelopeOpened как булевы флаги', () => {
    const result = guestPatchSchema.safeParse({ submitted: true, envelopeOpened: false })
    expect(result.success).toBe(true)
  })

  it('отклоняет submitted не булевого типа', () => {
    const result = guestPatchSchema.safeParse({ submitted: 'true' })
    expect(result.success).toBe(false)
  })

  it('принимает пустую строку fio, позволяя очистить ФИО', () => {
    const result = guestPatchSchema.safeParse({ fio: '' })
    expect(result.success).toBe(true)
  })
})

describe('guestPatchSchema / guestCreateSchema — attending и allowCompanions', () => {
  it('guestPatchSchema принимает attending: null (сброс ответа)', () => {
    const result = guestPatchSchema.safeParse({ attending: null })
    expect(result.success).toBe(true)
  })

  it('guestPatchSchema принимает allowCompanions', () => {
    const result = guestPatchSchema.safeParse({ allowCompanions: false })
    expect(result.success).toBe(true)
  })

  it('guestCreateSchema принимает allowCompanions при создании', () => {
    const result = guestCreateSchema.safeParse({ allowCompanions: false })
    expect(result.success).toBe(true)
  })
})
