import { describe, it, expect, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../../helpers/testDb'
import { createMockEvent } from '../../helpers/mockEvent'
import { guests, companions } from '../../../server/database/schema'
import { listGuests } from '../../../server/api/admin/guests/index.get'
import { updateGuest, default as patchGuestHandler } from '../../../server/api/admin/guests/[id].patch'
import { deleteGuest } from '../../../server/api/admin/guests/[id].delete'
import { guestPatchSchema } from '#shared/schemas/rsvp'

vi.mock('../../../server/utils/inviteCode', () => ({ generateInviteCode: vi.fn(() => 'STATICCODE') }))

import { generateInviteCode } from '../../../server/utils/inviteCode'
import { createGuestInvite, createUniqueInviteCode } from '../../../server/api/admin/guests/index.post'

function seedGuest(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: null, comment: null, drinks: ['red_dry'], createdAt: now, updatedAt: now
  }).returning({ id: guests.id }).get()
  testDb.insert(companions).values({ guestId: guest.id, fio: 'Петров Пётр', drinks: ['sparkling'] }).run()
  return guest.id
}

describe('admin guests API', () => {
  it('listGuests nests companions under each guest', async () => {
    const testDb = createTestDb()
    seedGuest(testDb)

    const result = await listGuests(testDb)
    expect(result).toHaveLength(1)
    expect(result[0].companions).toHaveLength(1)
    expect(result[0].companions[0].fio).toBe('Петров Пётр')
  })

  it('updateGuest updates fields and returns the row', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const updated = await updateGuest(id, { comment: 'Аллергия на орехи' }, testDb)
    expect(updated?.comment).toBe('Аллергия на орехи')
  })

  it('updateGuest returns null for missing id', async () => {
    const testDb = createTestDb()
    const updated = await updateGuest(999, { comment: 'x' }, testDb)
    expect(updated).toBeNull()
  })

  it('deleteGuest removes the row and cascades companions', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const deleted = await deleteGuest(id, testDb)
    expect(deleted).toBe(true)

    const remaining = await listGuests(testDb)
    expect(remaining).toHaveLength(0)

    const remainingCompanions = testDb.select().from(companions).where(eq(companions.guestId, id)).all()
    expect(remainingCompanions).toHaveLength(0)
  })

  it('deleteGuest returns false for missing id', async () => {
    const testDb = createTestDb()
    const deleted = await deleteGuest(999, testDb)
    expect(deleted).toBe(false)
  })
})

describe('guestPatchSchema (PATCH /api/admin/guests/:id validation)', () => {
  it('accepts a valid partial patch and updateGuest applies it', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const parsed = guestPatchSchema.safeParse({ comment: 'Аллергия на орехи' })
    expect(parsed.success).toBe(true)

    const updated = await updateGuest(id, parsed.success ? parsed.data : {}, testDb)
    expect(updated?.comment).toBe('Аллергия на орехи')
  })

  it('rejects a non-array drinks value', () => {
    const parsed = guestPatchSchema.safeParse({ drinks: 'red_dry' })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown extra key (e.g. id, createdAt)', () => {
    const parsed = guestPatchSchema.safeParse({ id: 999, comment: 'x' })
    expect(parsed.success).toBe(false)
  })

  it('handler responds 400 for invalid drinks value without touching the DB', async () => {
    const event = createMockEvent({
      method: 'PATCH',
      params: { id: '1' },
      body: { drinks: 'red_dry' },
      authenticated: true
    })

    await expect(patchGuestHandler(event)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('handler responds 400 for an unknown extra key without touching the DB', async () => {
    const event = createMockEvent({
      method: 'PATCH',
      params: { id: '1' },
      body: { id: 999, comment: 'x' },
      authenticated: true
    })

    await expect(patchGuestHandler(event)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('createGuestInvite (POST /api/admin/guests)', () => {
  it('создаёт гостя с пустыми полями и сгенерированным кодом', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({}, testDb)

    expect(created.fio).toBeNull()
    expect(created.submitted).toBe(false)
    expect(created.envelopeOpened).toBe(false)
    expect(created.inviteCode).toMatch(/^[A-Za-z0-9]{10}$/)
  })

  it('создаёт гостя с частичным предзаполнением', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({ fio: 'Иванов Иван', drinks: ['red_dry'] }, testDb)

    expect(created.fio).toBe('Иванов Иван')
    expect(created.drinks).toEqual(['red_dry'])
    expect(created.phone).toBeNull()
  })

  it('возвращает те же ключи, что и listGuests (не даёт двум источникам данных админки разойтись)', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({}, testDb)
    const listed = await listGuests(testDb)

    expect(Object.keys(created).sort()).toEqual(Object.keys(listed[0]!).sort())
  })

  it('создаёт фиксированное приглашение (allowCompanions: false)', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({ allowCompanions: false }, testDb)
    expect(created.allowCompanions).toBe(false)
  })

  it('по умолчанию создаёт приглашение с allowCompanions: true', async () => {
    const testDb = createTestDb()
    const created = await createGuestInvite({}, testDb)
    expect(created.allowCompanions).toBe(true)
  })
})

describe('updateGuest — переключение флагов submitted/envelopeOpened', () => {
  it('обновляет submitted и envelopeOpened через updateGuest', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const updated = await updateGuest(id, { submitted: true, envelopeOpened: true }, testDb)
    expect(updated?.submitted).toBe(true)
    expect(updated?.envelopeOpened).toBe(true)

    const reverted = await updateGuest(id, { submitted: false }, testDb)
    expect(reverted?.submitted).toBe(false)
    expect(reverted?.envelopeOpened).toBe(true)
  })
})

describe('updateGuest — attending и allowCompanions', () => {
  it('обновляет attending через updateGuest', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const updated = await updateGuest(id, { attending: true }, testDb)
    expect(updated?.attending).toBe(true)
  })

  it('сбрасывает attending обратно в null', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    await updateGuest(id, { attending: false }, testDb)
    const reverted = await updateGuest(id, { attending: null }, testDb)
    expect(reverted?.attending).toBeNull()
  })

  it('переключает allowCompanions', async () => {
    const testDb = createTestDb()
    const id = seedGuest(testDb)

    const updated = await updateGuest(id, { allowCompanions: false }, testDb)
    expect(updated?.allowCompanions).toBe(false)
  })
})

describe('createUniqueInviteCode — коллизия кода', () => {
  it('повторяет генерацию, если код уже занят', () => {
    const testDb = createTestDb()
    const now = new Date()
    testDb.insert(guests).values({
      fio: null, phone: null, comment: null, drinks: [],
      inviteCode: 'DUPLICATE1', createdAt: now, updatedAt: now
    }).run()

    vi.mocked(generateInviteCode)
      .mockReturnValueOnce('DUPLICATE1')
      .mockReturnValueOnce('FRESHCODE1')

    const code = createUniqueInviteCode(testDb)
    expect(code).toBe('FRESHCODE1')
  })

  it('падает после исчерпания всех попыток', () => {
    const testDb = createTestDb()
    const now = new Date()
    testDb.insert(guests).values({
      fio: null, phone: null, comment: null, drinks: [],
      inviteCode: 'ALWAYSSAME', createdAt: now, updatedAt: now
    }).run()

    vi.mocked(generateInviteCode).mockReturnValue('ALWAYSSAME')

    expect(() => createUniqueInviteCode(testDb)).toThrow()
  })
})
