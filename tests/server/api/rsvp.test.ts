import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { submitRsvp } from '../../../server/api/rsvp.post'
import { guests, companions } from '../../../server/database/schema'
import { eq } from 'drizzle-orm'

function seedInvite(testDb: ReturnType<typeof createTestDb>, code = 'ABC1234567') {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: null, phone: null, comment: null, drinks: [],
    inviteCode: code, submitted: false, envelopeOpened: false,
    createdAt: now, updatedAt: now
  }).returning({ id: guests.id }).get()
  return guest.id
}

describe('submitRsvp', () => {
  it('обновляет гостя по коду и проставляет submitted=true', async () => {
    const testDb = createTestDb()
    const guestId = seedInvite(testDb)

    const result = await submitRsvp({
      fio: 'Иванов Иван Иванович',
      phone: '+79990000000',
      comment: '',
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(true)

    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(guestId)
    expect(rows[0].fio).toBe('Иванов Иван Иванович')
    expect(rows[0].submitted).toBe(true)
  })

  it('заменяет спутников, если админ переоткрыл форму (submitted сброшен в false)', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    await submitRsvp({
      fio: 'Иванов Иван', drinks: [],
      companions: [{ fio: 'Первый спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    // Simulate the admin unchecking `submitted` to reopen the form for this guest —
    // otherwise the second submission would correctly be rejected with 409 (see the
    // "отклоняет повторную отправку" test below).
    testDb.update(guests).set({ submitted: false }).where(eq(guests.inviteCode, 'ABC1234567')).run()

    await submitRsvp({
      fio: 'Иванов Иван', drinks: [],
      companions: [{ fio: 'Второй спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    const rows = testDb.select().from(companions).where(eq(companions.guestId, guest.id)).all()

    expect(rows).toHaveLength(1)
    expect(rows[0].fio).toBe('Второй спутник')
  })

  it('отклоняет повторную отправку с 409, если submitted уже true', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const first = await submitRsvp({
      fio: 'Иванов Иван', drinks: [],
      companions: [{ fio: 'Первый спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })
    expect(first.ok).toBe(true)

    const second = await submitRsvp({
      fio: 'Иванов Иван', drinks: [],
      companions: [{ fio: 'Второй спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.status).toBe(409)
    }
  })

  it('404 при отсутствии кода приглашения', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: [], website: '' }, undefined, { dbInstance: testDb })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('404 при несуществующем коде приглашения', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: [], website: '' }, 'NOPE000000', { dbInstance: testDb })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('rejects missing fio', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: '', drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('rejects more than 3 companions', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const companionsList = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: companionsList, website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('silently drops honeypot submissions without touching the DB', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: 'Бот', drinks: [], companions: [], website: 'spam' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(true)

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    expect(guest.submitted).toBe(false)
  })
})
