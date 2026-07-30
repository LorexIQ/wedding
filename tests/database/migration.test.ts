import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../server/database/schema'

describe('migration verification', () => {
  it('migration 0001 applies successfully and creates columns with correct defaults', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')

    // First, create the initial schema (migration 0000 equivalent)
    sqlite.exec(`
      CREATE TABLE guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fio TEXT NOT NULL,
        phone TEXT,
        comment TEXT,
        drinks TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE companions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
        fio TEXT NOT NULL,
        drinks TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
      );
    `)

    // Insert some initial data
    const now = new Date()
    const nowMs = now.getTime()
    sqlite.prepare(`
      INSERT INTO guests (fio, phone, comment, drinks, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Иванов Иван', '+79990000000', 'Test', JSON.stringify(['red_dry']), nowMs, nowMs)

    sqlite.prepare(`
      INSERT INTO companions (guest_id, fio, drinks)
      VALUES (?, ?, ?)
    `).run(1, 'Петров Пётр', JSON.stringify(['white_dry']))

    // Now apply the corrected migration
    sqlite.exec(`
PRAGMA foreign_keys=OFF;
CREATE TABLE \`__new_guests\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`fio\` text,
	\`phone\` text,
	\`comment\` text,
	\`drinks\` text DEFAULT '[]' NOT NULL,
	\`invite_code\` text,
	\`submitted\` integer DEFAULT false NOT NULL,
	\`envelope_opened\` integer DEFAULT false NOT NULL,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL
);
INSERT INTO \`__new_guests\`("id", "fio", "phone", "comment", "drinks", "created_at", "updated_at") SELECT "id", "fio", "phone", "comment", "drinks", "created_at", "updated_at" FROM \`guests\`;
DROP TABLE \`guests\`;
ALTER TABLE \`__new_guests\` RENAME TO \`guests\`;
PRAGMA foreign_keys=ON;
CREATE UNIQUE INDEX \`guests_invite_code_unique\` ON \`guests\` (\`invite_code\`);
    `)

    // Create drizzle instance with schema
    const db = drizzle(sqlite, { schema })

    // Verify the schema
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
