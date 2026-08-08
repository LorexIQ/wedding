import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { companions } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'

export async function deleteCompanion(id: number, dbInstance: typeof db = db) {
  const existing = dbInstance.select().from(companions).where(eq(companions.id, id)).get()
  if (!existing) return false

  dbInstance.delete(companions).where(eq(companions.id, id)).run()
  return true
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const deleted = await deleteCompanion(id)

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Сопровождающий не найден' })
  }

  return { ok: true }
})
