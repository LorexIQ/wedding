import { defineEventHandler, getRequestHeader, getRequestIP, createError, readBody, setResponseStatus } from 'h3'
import { db } from '../database/client'
import { guests, companions } from '../database/schema'
import { rsvpSchema } from '#shared/schemas/rsvp'
import { checkRateLimit } from '../utils/rateLimit'

export async function submitRsvp(rawInput: unknown, opts: { dbInstance?: typeof db } = {}) {
  const database = opts.dbInstance ?? db
  const parsed = rsvpSchema.safeParse(rawInput)

  if (!parsed.success) {
    return { ok: false as const, status: 400, message: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }

  if (parsed.data.website) {
    return { ok: true as const, guestId: 0 }
  }

  const now = new Date()
  const data = parsed.data

  const inserted = database.transaction((tx) => {
    const insertedGuest = tx.insert(guests).values({
      fio: data.fio,
      phone: data.phone || null,
      comment: data.comment || null,
      drinks: data.drinks,
      createdAt: now,
      updatedAt: now
    }).returning({ id: guests.id }).get()

    for (const companion of data.companions) {
      tx.insert(companions).values({
        guestId: insertedGuest.id,
        fio: companion.fio,
        drinks: companion.drinks
      }).run()
    }

    return insertedGuest
  })

  return { ok: true as const, guestId: inserted.id }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'

  if (!checkRateLimit(`rsvp:${ip}`, 5, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const body = await readBody(event)
  const result = await submitRsvp(body)

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message })
  }

  setResponseStatus(event, 201)
  return { id: result.guestId }
})
