import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { submitRsvp } from '../../../server/api/rsvp.post'
import { guests } from '../../../server/database/schema'

describe('submitRsvp', () => {
  it('inserts a guest with companions', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({
      fio: 'Иванов Иван Иванович',
      phone: '+79990000000',
      comment: '',
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
      website: ''
    }, { dbInstance: testDb })

    expect(result.ok).toBe(true)
    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(1)
  })

  it('rejects missing fio', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: '', drinks: [], companions: [], website: '' }, { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('rejects more than 3 companions', async () => {
    const testDb = createTestDb()
    const companionsList = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: companionsList, website: '' }, { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('silently drops honeypot submissions without inserting', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Бот', drinks: [], companions: [], website: 'spam' }, { dbInstance: testDb })
    expect(result.ok).toBe(true)
    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(0)
  })
})
