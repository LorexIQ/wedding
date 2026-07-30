import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { guests } from '../../../server/database/schema'
import { resolveInvite } from '../../../server/api/invite/[code].get'

function seedInvite(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: '+79990000000', comment: null, drinks: ['red_dry'],
    inviteCode: 'ABC1234567', submitted: false, envelopeOpened: false,
    createdAt: now, updatedAt: now
  }).run()
}

describe('resolveInvite', () => {
  it('находит гостя по коду', () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const guest = resolveInvite('ABC1234567', testDb)
    expect(guest?.fio).toBe('Иванов Иван')
    expect(guest?.submitted).toBe(false)
  })

  it('возвращает null для неизвестного кода', () => {
    const testDb = createTestDb()
    const guest = resolveInvite('NOPE000000', testDb)
    expect(guest).toBeNull()
  })
})
