import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db, sqliteConnection } from '../database/client'

export default defineNitroPlugin(() => {
  // Foreign key enforcement must be toggled off at the connection level (not via a
  // PRAGMA inside the migration SQL) because drizzle-kit's table-recreate strategy
  // (CREATE __new_x -> INSERT SELECT -> DROP TABLE x -> RENAME) runs inside a single
  // BEGIN/COMMIT transaction, and SQLite only honors changes to the `foreign_keys`
  // pragma outside of a pending transaction. Without this, dropping a table with
  // dependent ON DELETE CASCADE rows (e.g. `guests` -> `companions`) would cascade-delete
  // those rows. This protects every drizzle-kit table-recreate migration, not just one.
  sqliteConnection.pragma('foreign_keys = OFF')
  try {
    migrate(db, { migrationsFolder: './server/database/migrations' })
  } finally {
    sqliteConnection.pragma('foreign_keys = ON')
  }
})
