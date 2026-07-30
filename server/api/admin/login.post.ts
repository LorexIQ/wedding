import { defineEventHandler, getRequestHeader, getRequestIP, createError, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { adminUsers } from '../../database/schema'
import { verifyPassword } from '../../utils/password'
import { checkRateLimit } from '../../utils/rateLimit'
import { getAdminSession } from '../../utils/session'

export async function authenticateAdmin(login: string, password: string, dbInstance: typeof db = db) {
  const user = dbInstance.select().from(adminUsers).where(eq(adminUsers.login, login)).get()
  if (!user) return null
  if (!verifyPassword(password, user.passwordHash)) return null
  return { id: user.id }
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'

  if (!checkRateLimit(`admin-login:${ip}`, 5, 15 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток, попробуйте позже' })
  }

  const body = await readBody<{ login?: string, password?: string }>(event)

  if (!body.login || !body.password) {
    throw createError({ statusCode: 401, statusMessage: 'Неверные данные' })
  }

  const admin = await authenticateAdmin(body.login, body.password)

  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Неверные данные' })
  }

  const session = await getAdminSession(event)
  await session.update({ adminId: admin.id })

  return { ok: true }
})
