import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../../helpers/testDb'
import { guests, companions } from '../../../server/database/schema'
import { deleteCompanion } from '../../../server/api/admin/companions/[id].delete'

function seedGuestWithCompanions(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  const guest = testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: null, comment: null, drinks: ['red_dry'], createdAt: now, updatedAt: now
  }).returning({ id: guests.id }).get()
  const companion1 = testDb.insert(companions).values({
    guestId: guest.id, fio: 'Петров Пётр', drinks: ['sparkling']
  }).returning({ id: companions.id }).get()
  const companion2 = testDb.insert(companions).values({
    guestId: guest.id, fio: 'Сидорова Анна', drinks: []
  }).returning({ id: companions.id }).get()
  return { guestId: guest.id, companion1Id: companion1.id, companion2Id: companion2.id }
}

describe('deleteCompanion', () => {
  it('удаляет сопровождающего и не трогает гостя или других сопровождающих', async () => {
    const testDb = createTestDb()
    const { guestId, companion1Id, companion2Id } = seedGuestWithCompanions(testDb)

    const deleted = await deleteCompanion(companion1Id, testDb)
    expect(deleted).toBe(true)

    const remaining = testDb.select().from(companions).where(eq(companions.guestId, guestId)).all()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe(companion2Id)

    const guest = testDb.select().from(guests).where(eq(guests.id, guestId)).get()
    expect(guest).toBeDefined()
  })

  it('возвращает false для несуществующего id', async () => {
    const testDb = createTestDb()
    const deleted = await deleteCompanion(999, testDb)
    expect(deleted).toBe(false)
  })
})
