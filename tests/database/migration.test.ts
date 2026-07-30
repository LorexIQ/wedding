import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../server/database/schema'

describe('migration verification', () => {
  it('migrations 0000 and 0001 apply successfully and create correct schema', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')

    // Create drizzle instance with schema
    const db = drizzle(sqlite, { schema })

    // Apply real migrations from server/database/migrations/ using drizzle's migrator
    // This matches how the app runs migrations in server/plugins/00.migrate.ts
    // It will apply both 0000 (initial schema) and 0001 (add new columns, relax fio)
    migrate(db, { migrationsFolder: './server/database/migrations' })

    // Insert some test data after migrations are applied
    const now = new Date()
    const nowMs = now.getTime()
    db.insert(schema.guests).values({
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: 'Test',
      drinks: ['red_dry'],
      createdAt: new Date(nowMs),
      updatedAt: new Date(nowMs)
    }).run()

    db.insert(schema.companions).values({
      guestId: 1,
      fio: 'Петров Пётр',
      drinks: ['white_dry']
    }).run()

    // Verify the schema after migration
    const guests = db.select().from(schema.guests).all()

    expect(guests).toHaveLength(1)
    expect(guests[0].id).toBe(1)
    expect(guests[0].fio).toBe('Иванов Иван')
    expect(guests[0].phone).toBe('+79990000000')
    expect(guests[0].comment).toBe('Test')
    expect(guests[0].drinks).toEqual(['red_dry'])
    expect(guests[0].inviteCode).toBeNull()
    expect(guests[0].submitted).toBe(false)
    expect(guests[0].envelopeOpened).toBe(false)
    expect(guests[0].createdAt).toBeDefined()
    expect(guests[0].updatedAt).toBeDefined()
    expect(guests[0].createdAt instanceof Date).toBe(true)
    expect(guests[0].updatedAt instanceof Date).toBe(true)

    // Verify companions still exist and reference is intact
    const companions = db.select().from(schema.companions).all()
    expect(companions).toHaveLength(1)
    expect(companions[0].fio).toBe('Петров Пётр')

    // Verify unique constraint on invite_code
    db.insert(schema.guests).values({
      fio: 'Test Guest',
      phone: null,
      comment: null,
      drinks: [],
      inviteCode: 'TEST123',
      createdAt: new Date(),
      updatedAt: new Date()
    }).run()

    expect(() => {
      db.insert(schema.guests).values({
        fio: 'Another Guest',
        phone: null,
        comment: null,
        drinks: [],
        inviteCode: 'TEST123',
        createdAt: new Date(),
        updatedAt: new Date()
      }).run()
    }).toThrow()

    sqlite.close()
  })
})
