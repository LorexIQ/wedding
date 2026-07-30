import { describe, it, expect } from 'vitest'
import { formatFio } from '../../app/utils/formatFio'

describe('formatFio', () => {
  it('обрезает края и схлопывает повторные пробелы', () => {
    expect(formatFio('  Иванов   Иван  ')).toBe('Иванов Иван')
  })

  it('приводит каждое слово к заглавной букве', () => {
    expect(formatFio('иванов иван')).toBe('Иванов Иван')
  })

  it('приводит к заглавной букве обе части дефисного имени', () => {
    expect(formatFio('петрова-сидорова анна-мария')).toBe('Петрова-Сидорова Анна-Мария')
  })

  it('не падает на пустой строке', () => {
    expect(formatFio('')).toBe('')
  })

  it('не портит уже корректно оформленное имя', () => {
    expect(formatFio('Иванов Иван')).toBe('Иванов Иван')
  })
})
