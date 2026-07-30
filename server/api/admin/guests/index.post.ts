import { defineEventHandler, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../database/client'
import { guests } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'
import { generateInviteCode } from '../../../utils/inviteCode'
import { guestCreateSchema, type GuestCreateInput } from '#shared/schemas/rsvp'

const MAX_CODE_ATTEMPTS = 3

export function createUniqueInviteCode(dbInstance: typeof db = db): string {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const existing = dbInstance.select().from(guests).where(eq(guests.inviteCode, code)).get()
    if (!existing) return code
  }
  throw createError({ statusCode: 500, statusMessage: 'Не удалось сгенерировать код приглашения' })
}

export async function createGuestInvite(input: GuestCreateInput, dbInstance: typeof db = db) {
  const now = new Date()
  const inviteCode = createUniqueInviteCode(dbInstance)

  return dbInstance.insert(guests).values({
    fio: input.fio || null,
    phone: input.phone || null,
    comment: input.comment || null,
    drinks: input.drinks ?? [],
    inviteCode,
    submitted: false,
    envelopeOpened: false,
    createdAt: now,
    updatedAt: now
  }).returning().get()
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const body = await readBody(event)
  const parsed = guestCreateSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
  }

  return createGuestInvite(parsed.data)
})
