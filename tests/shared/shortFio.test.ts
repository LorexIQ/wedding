import { describe, it, expect } from 'vitest'
import { shortFio } from '../../shared/utils/shortFio'

describe('shortFio', () => {
  it('возвращает пустую строку для null/undefined/пустого значения', () => {
    expect(shortFio(null)).toBe('')
    expect(shortFio(undefined)).toBe('')
    expect(shortFio('')).toBe('')
  })

  it('не падает на одном слове', () => {
    expect(shortFio('Иван')).toBe('Иван')
  })

  it('оставляет имя и фамилию без изменений', () => {
    expect(shortFio('Иван Петров')).toBe('Иван Петров')
  })

  it('оставляет только первые два слова, что бы ни шло дальше (например, отчество)', () => {
    expect(shortFio('Иван Петров Петрович')).toBe('Иван Петров')
  })

  it('схлопывает лишние пробелы между словами', () => {
    expect(shortFio('  Иван   Петров   Петрович  ')).toBe('Иван Петров')
  })
})
