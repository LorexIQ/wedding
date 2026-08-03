import { defineEventHandler } from 'h3'
import { db } from '../../database/client'
import { requireAdminSession } from '../../utils/session'
import { getRsvpDeadline } from '../../utils/settings'

export function getSettings(dbInstance: typeof db = db) {
  const deadline = getRsvpDeadline(dbInstance)
  return { rsvpDeadlineAt: deadline ? deadline.getTime() : null }
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return getSettings()
})
