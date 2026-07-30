import { createEvent } from 'h3'
import type { H3Event } from 'h3'

// Builds a minimal H3Event good enough to drive `defineEventHandler` default
// exports directly in tests, without booting a real Nitro server.
//
// h3's `useSession`/`getSession` (see server/utils/session.ts) look for an
// already-established session under `event.context.sessions[name]` before
// falling back to unsealing a cookie. Pre-populating that map lets tests
// simulate "logged in" / "logged out" requests without dealing with the
// iron-webcrypto sealing used by real cookies.
interface MockEventOptions {
  method?: string
  params?: Record<string, string>
  body?: unknown
  authenticated?: boolean
  sessionName?: string
}

export function createMockEvent(opts: MockEventOptions = {}): H3Event {
  const rawBody = opts.body !== undefined ? JSON.stringify(opts.body) : undefined

  const req: any = {
    method: opts.method ?? 'GET',
    url: '/',
    headers: rawBody ? { 'content-type': 'application/json' } : {},
    rawBody,
    socket: { remoteAddress: '127.0.0.1' }
  }

  const res: any = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader() {},
    getHeader() {},
    getHeaders() { return {} },
    removeHeader() {},
    end() {}
  }

  const event = createEvent(req, res)
  event.context.params = opts.params ?? {}

  if (opts.authenticated) {
    const sessionName = opts.sessionName ?? 'wedding_admin_session'
    event.context.sessions = {
      [sessionName]: {
        id: 'mock-session-id',
        createdAt: Date.now(),
        data: { adminId: 1 }
      }
    }
  }

  return event
}
