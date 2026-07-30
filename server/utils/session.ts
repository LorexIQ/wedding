import type { H3Event } from 'h3'
import { useSession, createError } from 'h3'

interface AdminSessionData {
  adminId?: number
}

export function getAdminSession(event: H3Event) {
  const config = useRuntimeConfig()
  return useSession<AdminSessionData>(event, {
    password: config.sessionSecret,
    name: 'wedding_admin_session',
    maxAge: 60 * 60 * 24 * 7
  })
}

export async function requireAdminSession(event: H3Event) {
  const session = await getAdminSession(event)
  if (!session.data.adminId) {
    throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' })
  }
  return session
}
