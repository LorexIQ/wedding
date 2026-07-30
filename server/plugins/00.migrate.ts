import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../database/client'

export default defineNitroPlugin(() => {
  migrate(db, { migrationsFolder: './server/database/migrations' })
})
