import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../helpers/testDb'
import { guests, companions, adminUsers, settings } from '../../server/database/schema'

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

  it('invite_code уникален, submitted/envelopeOpened по умолчанию false', () => {
    const db = createTestDb()
    const now = new Date()

    const guest = db.insert(guests).values({
      fio: null,
      phone: null,
      comment: null,
      drinks: [],
      inviteCode: 'ABC1234567',
      createdAt: now,
      updatedAt: now
    }).returning().get()

    expect(guest.submitted).toBe(false)
    expect(guest.envelopeOpened).toBe(false)
    expect(guest.fio).toBeNull()

    expect(() =>
      db.insert(guests).values({
        fio: null, phone: null, comment: null, drinks: [],
        inviteCode: 'ABC1234567', createdAt: now, updatedAt: now
      }).run()
    ).toThrow()
  })

  it('attending по умолчанию null, allowCompanions по умолчанию true', () => {
    const db = createTestDb()
    const now = new Date()

    const guest = db.insert(guests).values({
      fio: null, phone: null, comment: null, drinks: [],
      createdAt: now, updatedAt: now
    }).returning().get()

    expect(guest.attending).toBeNull()
    expect(guest.allowCompanions).toBe(true)
  })

  it('settings хранит и возвращает дедлайн, по умолчанию таблица пуста', () => {
    const db = createTestDb()
    expect(db.select().from(settings).all()).toHaveLength(0)

    const deadline = new Date('2026-08-10T21:00:00+03:00')
    db.insert(settings).values({ id: 1, rsvpDeadlineAt: deadline }).run()

    const row = db.select().from(settings).where(eq(settings.id, 1)).get()
    expect(row?.rsvpDeadlineAt?.getTime()).toBe(deadline.getTime())
  })
})
