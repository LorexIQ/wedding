import { describe, it, expect, vi, afterEach } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { submitRsvp } from '../../../server/api/rsvp.post'
import { guests, companions } from '../../../server/database/schema'
import { setRsvpDeadline } from '../../../server/utils/settings'
import { eq } from 'drizzle-orm'

function seedInvite(testDb: ReturnType<typeof createTestDb>, code = 'ABC1234567', overrides: Partial<typeof guests.$inferInsert> = {}) {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: null, phone: null, comment: null, drinks: [],
    inviteCode: code, submitted: false, envelopeOpened: false,
    allowCompanions: true,
    createdAt: now, updatedAt: now,
    ...overrides
  }).returning({ id: guests.id }).get()
  return guest.id
}

describe('submitRsvp', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('обновляет гостя по коду и проставляет submitted=true', async () => {
    const testDb = createTestDb()
    const guestId = seedInvite(testDb)

    const result = await submitRsvp({
      fio: 'Иванов Иван Иванович',
      phone: '+7 999 000-00-00',
      comment: '',
      attending: true,
      drinks: ['red_dry'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(true)

    const rows = testDb.select().from(guests).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(guestId)
    expect(rows[0].fio).toBe('Иванов Иван Иванович')
    expect(rows[0].attending).toBe(true)
    expect(rows[0].submitted).toBe(true)
  })

  it('позволяет отправить ответ повторно до дедлайна, заменяя спутников', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    await submitRsvp({
      fio: 'Иванов Иван', attending: true, drinks: [],
      companions: [{ fio: 'Первый спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    const second = await submitRsvp({
      fio: 'Иванов Иван', attending: true, drinks: [],
      companions: [{ fio: 'Второй спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(second.ok).toBe(true)

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    const rows = testDb.select().from(companions).where(eq(companions.guestId, guest.id)).all()

    expect(rows).toHaveLength(1)
    expect(rows[0].fio).toBe('Второй спутник')
  })

  it('attending: false принудительно очищает напитки и спутников, даже если клиент их прислал', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const result = await submitRsvp({
      fio: 'Иванов Иван', attending: false,
      drinks: ['red_dry'],
      companions: [{ fio: 'Спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(true)

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    expect(guest.attending).toBe(false)
    expect(guest.drinks).toEqual([])

    const savedCompanions = testDb.select().from(companions).where(eq(companions.guestId, guest.id)).all()
    expect(savedCompanions).toHaveLength(0)
  })

  it('400, если спутники присланы для приглашения с allowCompanions=false', async () => {
    const testDb = createTestDb()
    seedInvite(testDb, 'ABC1234567', { allowCompanions: false })

    const result = await submitRsvp({
      fio: 'Иванов Иван', attending: true, drinks: [],
      companions: [{ fio: 'Спутник', drinks: [] }],
      website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('403 при первой отправке после дедлайна', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    setRsvpDeadline(new Date('2026-08-10T00:00:00Z'), testDb)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:01Z'))

    const result = await submitRsvp({
      fio: 'Тест', attending: true, drinks: [], companions: [], website: ''
    }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it('403 на повторную отправку после дедлайна, даже если раньше уже отвечал', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    await submitRsvp({ fio: 'Тест', attending: true, drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })

    setRsvpDeadline(new Date('2026-08-10T00:00:00Z'), testDb)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:01Z'))

    const result = await submitRsvp({ fio: 'Тест', attending: false, drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it('разрешает отправку ровно перед дедлайном (не включительно)', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    setRsvpDeadline(new Date('2026-08-10T00:00:00Z'), testDb)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T23:59:59Z'))

    const result = await submitRsvp({ fio: 'Тест', attending: true, drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })

    expect(result.ok).toBe(true)
  })

  it('404 при отсутствии кода приглашения', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Тест', attending: true, drinks: [], companions: [], website: '' }, undefined, { dbInstance: testDb })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('404 при несуществующем коде приглашения', async () => {
    const testDb = createTestDb()
    const result = await submitRsvp({ fio: 'Тест', attending: true, drinks: [], companions: [], website: '' }, 'NOPE000000', { dbInstance: testDb })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('rejects missing fio', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: '', attending: true, drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('rejects missing attending', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: 'Тест', drinks: [], companions: [], website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('rejects more than 3 companions', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const companionsList = Array.from({ length: 4 }, (_, i) => ({ fio: `Гость ${i}`, drinks: [] }))
    const result = await submitRsvp({ fio: 'Тест', attending: true, drinks: [], companions: companionsList, website: '' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(false)
  })

  it('silently drops honeypot submissions without touching the DB', async () => {
    const testDb = createTestDb()
    seedInvite(testDb)
    const result = await submitRsvp({ fio: 'Бот', attending: true, drinks: [], companions: [], website: 'spam' }, 'ABC1234567', { dbInstance: testDb })
    expect(result.ok).toBe(true)

    const guest = testDb.select().from(guests).where(eq(guests.inviteCode, 'ABC1234567')).get()!
    expect(guest.submitted).toBe(false)
  })
})
