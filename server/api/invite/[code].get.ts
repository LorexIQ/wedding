import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { guests } from '../../database/schema'

export function resolveInvite(code: string, dbInstance: typeof db = db) {
  return dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get() ?? null
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Код не указан' })
  }

  const guest = resolveInvite(code)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: 'Приглашение не найдено' })
  }

  return {
    fio: guest.fio,
    phone: guest.phone,
    comment: guest.comment,
    drinks: guest.drinks,
    submitted: guest.submitted,
    envelopeOpened: guest.envelopeOpened
  }
})
