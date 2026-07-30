import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../server/database/schema'
import { hashPassword } from '../server/utils/password'

const [, , login, password] = process.argv

if (!login || !password) {
  console.error('Usage: npm run seed:admin -- <login> <password>')
  process.exit(1)
}

const sqlite = new Database(process.env.DB_PATH || './data/wedding.db')
const db = drizzle(sqlite, { schema })

db.insert(schema.adminUsers)
  .values({ login, passwordHash: hashPassword(password) })
  .onConflictDoUpdate({
    target: schema.adminUsers.login,
    set: { passwordHash: hashPassword(password) }
  })
  .run()

console.log(`Admin "${login}" сохранён.`)
