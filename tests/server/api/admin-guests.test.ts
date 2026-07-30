import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../../helpers/testDb'
import { createMockEvent } from '../../helpers/mockEvent'
import { guests, companions } from '../../../server/database/schema'
import { listGuests } from '../../../server/api/admin/guests/index.get'
import { updateGuest, default as patchGuestHandler } from '../../../server/api/admin/guests/[id].patch'
import { deleteGuest } from '../../../server/api/admin/guests/[id].delete'
import { guestPatchSchema } from '#shared/schemas/rsvp'

function seedGuest(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: null, comment: null, drinks: ['wine'], createdAt: now, updatedAt: now
  }).returning({ id: guests.id }).get()
  testDb.insert(companions).values({ guestId: guest.id, fio: 'Петров Пётр', drinks: ['beer'] }).run()
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
    const parsed = guestPatchSchema.safeParse({ drinks: 'wine' })
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
      body: { drinks: 'wine' },
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
