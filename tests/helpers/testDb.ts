import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../server/database/schema'

export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fio TEXT,
      phone TEXT,
      comment TEXT,
      drinks TEXT NOT NULL DEFAULT '[]',
      invite_code TEXT UNIQUE,
      submitted INTEGER NOT NULL DEFAULT 0,
      envelope_opened INTEGER NOT NULL DEFAULT 0,
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

  return drizzle(sqlite, { schema })
}
