import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../database/client'
import { requireAdminSession } from '../../utils/session'
import { setRsvpDeadline } from '../../utils/settings'
import { settingsPatchSchema } from '#shared/schemas/settings'

export function patchSettings(rawInput: unknown, dbInstance: typeof db = db) {
  const parsed = settingsPatchSchema.safeParse(rawInput)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
  }

  if (parsed.data.rsvpDeadlineAt === null) {
    setRsvpDeadline(null, dbInstance)
    return { rsvpDeadlineAt: null }
  }

  const date = new Date(parsed.data.rsvpDeadlineAt)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректная дата' })
  }

  setRsvpDeadline(date, dbInstance)
  return { rsvpDeadlineAt: date.getTime() }
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const body = await readBody(event)
  return patchSettings(body)
})
