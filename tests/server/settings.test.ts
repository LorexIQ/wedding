import { describe, it, expect } from 'vitest'
import { createTestDb } from '../helpers/testDb'
import { getRsvpDeadline, setRsvpDeadline } from '../../server/utils/settings'

describe('getRsvpDeadline / setRsvpDeadline', () => {
  it('возвращает null, если строка настроек ещё не создана', () => {
    const testDb = createTestDb()
    expect(getRsvpDeadline(testDb)).toBeNull()
  })

  it('сохраняет и возвращает дедлайн', () => {
    const testDb = createTestDb()
    const deadline = new Date('2026-08-10T21:00:00+03:00')

    setRsvpDeadline(deadline, testDb)

    expect(getRsvpDeadline(testDb)?.getTime()).toBe(deadline.getTime())
  })

  it('повторный вызов setRsvpDeadline обновляет значение, а не создаёт вторую строку', () => {
    const testDb = createTestDb()
    setRsvpDeadline(new Date('2026-08-10T21:00:00+03:00'), testDb)
    setRsvpDeadline(new Date('2026-08-12T21:00:00+03:00'), testDb)

    expect(getRsvpDeadline(testDb)?.toISOString()).toBe(new Date('2026-08-12T21:00:00+03:00').toISOString())
  })

  it('setRsvpDeadline(null) снимает ограничение', () => {
    const testDb = createTestDb()
    setRsvpDeadline(new Date('2026-08-10T21:00:00+03:00'), testDb)
    setRsvpDeadline(null, testDb)

    expect(getRsvpDeadline(testDb)).toBeNull()
  })
})
