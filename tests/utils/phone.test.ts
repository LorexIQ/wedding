import { describe, it, expect } from 'vitest'
import { formatPhone, maskPhone } from '../../app/utils/phone'

describe('телефон в подвале', () => {
  it('форматирует номер по-человечески', () => {
    expect(formatPhone('79066951293')).toBe('+7 906 695-12-93')
  })

  it('прячет всё, кроме кода оператора', () => {
    expect(maskPhone('79066951293')).toBe('+7 906 •••-••-••')
  })

  it('собирает ссылку для звонка', () => {
    expect(formatPhone('79066951293').replace(/[^\d+]/g, '')).toBe('+79066951293')
  })
})
