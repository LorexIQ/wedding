import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fio: text('fio'),
  phone: text('phone'),
  comment: text('comment'),
  drinks: text('drinks', { mode: 'json' }).$type<string[]>().notNull().default([]),
  inviteCode: text('invite_code').unique(),
  submitted: integer('submitted', { mode: 'boolean' }).notNull().default(false),
  envelopeOpened: integer('envelope_opened', { mode: 'boolean' }).notNull().default(false),
  attending: integer('attending', { mode: 'boolean' }),
  allowCompanions: integer('allow_companions', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const companions = sqliteTable('companions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  fio: text('fio').notNull(),
  drinks: text('drinks', { mode: 'json' }).$type<string[]>().notNull().default([])
})

export const adminUsers = sqliteTable('admin_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  login: text('login').notNull().unique(),
  passwordHash: text('password_hash').notNull()
})

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rsvpDeadlineAt: integer('rsvp_deadline_at', { mode: 'timestamp' })
})
