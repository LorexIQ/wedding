import { defineEventHandler, getRouterParam, getRequestHeader, getRequestIP, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { guests, companions } from '../../database/schema'
import { checkRateLimit } from '../../utils/rateLimit'
import { getRsvpDeadline } from '../../utils/settings'

export function resolveInvite(code: string, dbInstance: typeof db = db) {
  return dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get() ?? null
}

export function getInviteResponse(code: string, dbInstance: typeof db = db) {
  const guest = resolveInvite(code, dbInstance)
  if (!guest) return null

  const guestCompanions = dbInstance.select().from(companions).where(eq(companions.guestId, guest.id)).all()
  const deadline = getRsvpDeadline(dbInstance)

  return {
    fio: guest.fio,
    phone: guest.phone,
    comment: guest.comment,
    drinks: guest.drinks,
    submitted: guest.submitted,
    envelopeOpened: guest.envelopeOpened,
    attending: guest.attending,
    allowCompanions: guest.allowCompanions,
    companions: guestCompanions,
    rsvpDeadlineAt: deadline ? deadline.getTime() : null
  }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'
  if (!checkRateLimit(`invite:${ip}`, 20, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Код не указан' })
  }

  const response = getInviteResponse(code)
  if (!response) {
    throw createError({ statusCode: 404, statusMessage: 'Приглашение не найдено' })
  }

  return response
})
