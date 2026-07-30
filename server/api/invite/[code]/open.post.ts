import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'

export function markEnvelopeOpened(code: string, dbInstance: typeof db = db) {
  const guest = dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get()
  if (!guest) return null

  dbInstance.update(guests)
    .set({ envelopeOpened: true, updatedAt: new Date() })
    .where(eq(guests.id, guest.id))
    .run()

  return true
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Код не указан' })
  }

  const ok = markEnvelopeOpened(code)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Приглашение не найдено' })
  }

  return { ok: true }
})
