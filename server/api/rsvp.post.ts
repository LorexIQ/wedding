import { defineEventHandler, getRequestHeader, getRequestIP, getCookie, createError, readBody, setResponseStatus } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { guests, companions } from '../database/schema'
import { rsvpSchema } from '#shared/schemas/rsvp'
import { checkRateLimit } from '../utils/rateLimit'

export async function submitRsvp(rawInput: unknown, inviteCode: string | undefined, opts: { dbInstance?: typeof db } = {}) {
  const database = opts.dbInstance ?? db
  const parsed = rsvpSchema.safeParse(rawInput)

  if (!parsed.success) {
    return { ok: false as const, status: 400, message: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }

  if (parsed.data.website) {
    return { ok: true as const, guestId: 0 }
  }

  if (!inviteCode) {
    return { ok: false as const, status: 404, message: 'Приглашение не найдено' }
  }

  const existing = database.select().from(guests).where(eq(guests.inviteCode, inviteCode)).get()
  if (!existing) {
    return { ok: false as const, status: 404, message: 'Приглашение не найдено' }
  }

  const now = new Date()
  const data = parsed.data

  database.transaction((tx) => {
    tx.update(guests).set({
      fio: data.fio,
      phone: data.phone || null,
      comment: data.comment || null,
      drinks: data.drinks,
      submitted: true,
      updatedAt: now
    }).where(eq(guests.id, existing.id)).run()

    tx.delete(companions).where(eq(companions.guestId, existing.id)).run()

    for (const companion of data.companions) {
      tx.insert(companions).values({
        guestId: existing.id,
        fio: companion.fio,
        drinks: companion.drinks
      }).run()
    }
  })

  return { ok: true as const, guestId: existing.id }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'

  if (!checkRateLimit(`rsvp:${ip}`, 5, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const inviteCode = getCookie(event, 'invite_code')
  const body = await readBody(event)
  const result = await submitRsvp(body, inviteCode)

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message })
  }

  setResponseStatus(event, 201)
  return { id: result.guestId }
})
