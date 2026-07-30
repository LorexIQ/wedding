import { describe, it, expect } from 'vitest'
import { splitRemaining } from '../../app/utils/countdown'

describe('splitRemaining', () => {
  it('разбивает остаток на дни, часы, минуты и секунды', () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000
    expect(splitRemaining(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 })
  })

  it('отдаёт нули, когда дата уже прошла', () => {
    expect(splitRemaining(-100000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })

  it('отдаёт нули ровно в момент события', () => {
    expect(splitRemaining(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
