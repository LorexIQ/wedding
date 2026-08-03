import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../server/database/schema'

const REAL_MIGRATIONS_FOLDER = './server/database/migrations'

describe('migration verification', () => {
  it('migrations 0000, 0001 and 0002 apply successfully and create correct schema', () => {
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
    expect(guests[0].attending).toBeNull()
    expect(guests[0].allowCompanions).toBe(true)
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

  it('preserves pre-existing companion rows when migration 0001 recreates the guests table (production upgrade scenario)', () => {
    // This reproduces the real-world upgrade path: a database that already has data
    // from migration 0000 (guests without invite_code/submitted/envelope_opened, plus
    // companions referencing them via an ON DELETE CASCADE foreign key), then migration
    // 0001 runs on top of it. Unlike the test above (which seeds data AFTER migrating,
    // the safe path), this seeds data BEFORE migration 0001 runs — the actual production
    // scenario where migration 0001's table-recreate strategy for `guests` (DROP TABLE
    // guests) can cascade-delete every companion row if foreign key enforcement is not
    // correctly suspended for the duration of the migration transaction.
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite, { schema })

    // Apply ONLY migration 0000 first, via a temp migrations folder containing just
    // that one migration + a matching journal, to simulate a pre-0001 database.
    const tempDir = mkdtempSync(join(tmpdir(), 'migration-0000-only-'))
    try {
      mkdirSync(join(tempDir, 'meta'), { recursive: true })
      const journal = JSON.parse(readFileSync(join(REAL_MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf-8'))
      const firstEntry = journal.entries[0]
      writeFileSync(join(tempDir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: [firstEntry] }))
      writeFileSync(
        join(tempDir, `${firstEntry.tag}.sql`),
        readFileSync(join(REAL_MIGRATIONS_FOLDER, `${firstEntry.tag}.sql`))
      )

      migrate(db, { migrationsFolder: tempDir })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }

    // Seed a guest + companion using RAW SQL matching the pre-migration (0000-only)
    // schema — drizzle's typed schema.guests already expects post-0001 columns
    // (invite_code, submitted, envelope_opened) that don't exist on the table yet.
    const now = Date.now()
    sqlite.prepare(
      'INSERT INTO guests (fio, phone, comment, drinks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('Иванов Иван', '+79990000000', 'Test', '["red_dry"]', now, now)
    sqlite.prepare(
      'INSERT INTO companions (guest_id, fio, drinks) VALUES (?, ?, ?)'
    ).run(1, 'Петров Пётр', '["white_dry"]')

    // Now run the real migrations folder, wrapped the same way server/plugins/00.migrate.ts
    // wraps it: foreign key enforcement toggled off at the connection level around the
    // migrate() call. Migration 0000 is already recorded as applied and will be skipped;
    // migration 0001 actually runs and must NOT cascade-delete the companion row when it
    // drops and recreates `guests`.
    sqlite.pragma('foreign_keys = OFF')
    try {
      migrate(db, { migrationsFolder: REAL_MIGRATIONS_FOLDER })
    } finally {
      sqlite.pragma('foreign_keys = ON')
    }

    const guestsAfter = db.select().from(schema.guests).all()
    expect(guestsAfter).toHaveLength(1)
    expect(guestsAfter[0].fio).toBe('Иванов Иван')

    const companionsAfter = db.select().from(schema.companions).all()
    expect(companionsAfter).toHaveLength(1)
    expect(companionsAfter[0].fio).toBe('Петров Пётр')

    sqlite.close()
  })
})
