import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../helpers/testDb'
import { guests, companions, adminUsers } from '../../server/database/schema'

describe('schema', () => {
  it('inserts a guest with a companion and reads them back', () => {
    const db = createTestDb()
    const now = new Date()

    const guest = db.insert(guests).values({
      fio: 'Иванов Иван Иванович',
      phone: '+79990000000',
      comment: null,
      drinks: ['red_dry'],
      createdAt: now,
      updatedAt: now
    }).returning({ id: guests.id }).get()

    db.insert(companions).values({
      guestId: guest.id,
      fio: 'Петров Пётр',
      drinks: ['sparkling']
    }).run()

    const savedGuest = db.select().from(guests).where(eq(guests.id, guest.id)).get()
    const savedCompanions = db.select().from(companions).where(eq(companions.guestId, guest.id)).all()

    expect(savedGuest?.fio).toBe('Иванов Иван Иванович')
    expect(savedGuest?.drinks).toEqual(['red_dry'])
    expect(savedCompanions).toHaveLength(1)
    expect(savedCompanions[0].fio).toBe('Петров Пётр')
  })

  it('enforces unique admin login', () => {
    const db = createTestDb()
    db.insert(adminUsers).values({ login: 'bride', passwordHash: 'x' }).run()

    expect(() =>
      db.insert(adminUsers).values({ login: 'bride', passwordHash: 'y' }).run()
    ).toThrow()
  })
})
