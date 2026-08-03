import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { getSettings } from '../../../server/api/admin/settings.get'
import { patchSettings } from '../../../server/api/admin/settings.patch'

describe('admin settings API', () => {
  it('getSettings возвращает null, если дедлайн не задан', () => {
    const testDb = createTestDb()
    expect(getSettings(testDb)).toEqual({ rsvpDeadlineAt: null })
  })

  it('patchSettings сохраняет дедлайн и возвращает его в ms', () => {
    const testDb = createTestDb()
    const result = patchSettings({ rsvpDeadlineAt: '2026-08-10T21:00' }, testDb)
    expect(result.rsvpDeadlineAt).toBe(new Date('2026-08-10T21:00').getTime())
    expect(getSettings(testDb)).toEqual(result)
  })

  it('patchSettings(null) снимает дедлайн', () => {
    const testDb = createTestDb()
    patchSettings({ rsvpDeadlineAt: '2026-08-10T21:00' }, testDb)
    const result = patchSettings({ rsvpDeadlineAt: null }, testDb)
    expect(result.rsvpDeadlineAt).toBeNull()
  })

  it('patchSettings бросает на некорректную дату', () => {
    const testDb = createTestDb()
    expect(() => patchSettings({ rsvpDeadlineAt: 'not-a-date' }, testDb)).toThrow()
  })
})
