import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'
import { guestPatchSchema, type GuestPatchInput } from '#shared/schemas/rsvp'

export async function updateGuest(id: number, input: GuestPatchInput, dbInstance: typeof db = db) {
  const existing = dbInstance.select().from(guests).where(eq(guests.id, id)).get()
  if (!existing) return null

  dbInstance.update(guests)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(guests.id, id))
    .run()

  return dbInstance.select().from(guests).where(eq(guests.id, id)).get() ?? null
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const parsed = guestPatchSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
  }

  const updated = await updateGuest(id, parsed.data)

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Гость не найден' })
  }

  return updated
})
