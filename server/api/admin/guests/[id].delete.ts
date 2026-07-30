import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'

export async function deleteGuest(id: number, dbInstance: typeof db = db) {
  const existing = dbInstance.select().from(guests).where(eq(guests.id, id)).get()
  if (!existing) return false

  dbInstance.delete(guests).where(eq(guests.id, id)).run()
  return true
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const deleted = await deleteGuest(id)

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Гость не найден' })
  }

  return { ok: true }
})
