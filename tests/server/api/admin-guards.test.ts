import { describe, it, expect } from 'vitest'
import { createMockEvent } from '../../helpers/mockEvent'
import listGuestsHandler from '../../../server/api/admin/guests/index.get'
import patchGuestHandler from '../../../server/api/admin/guests/[id].patch'
import deleteGuestHandler from '../../../server/api/admin/guests/[id].delete'
import exportGuestsHandler from '../../../server/api/admin/guests/export.get'

// Every admin route's default export calls `requireAdminSession(event)` as
// its very first line (server/utils/session.ts). Nothing in the rest of the
// test suite exercises that default export directly — every other test in
// tests/server/api/ imports and calls the pure exported function
// (listGuests/updateGuest/deleteGuest/...) instead, bypassing the handler
// wrapper entirely. That means deleting the `requireAdminSession` line from
// any of these handlers would leave the full suite green with no warning.
//
// These tests invoke the real `defineEventHandler` default export with an
// unauthenticated mock H3Event (built via tests/helpers/mockEvent.ts, which
// uses h3's own `createEvent` plus a pre-seeded `event.context.sessions` map
// to sidestep real cookie sealing) and assert it rejects with 401 *before*
// reaching the database — since the in-memory `db` singleton these handlers
// fall back to has no migrations applied under Vitest, reaching past the
// guard would throw a "no such table" error instead, which would also make
// these tests fail (for the wrong reason) if the guard were ever removed.
describe('admin route auth guards', () => {
  it('GET /api/admin/guests rejects an unauthenticated request with 401', async () => {
    const event = createMockEvent({ method: 'GET' })
    await expect(listGuestsHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('PATCH /api/admin/guests/:id rejects an unauthenticated request with 401', async () => {
    const event = createMockEvent({ method: 'PATCH', params: { id: '1' }, body: { comment: 'x' } })
    await expect(patchGuestHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('DELETE /api/admin/guests/:id rejects an unauthenticated request with 401', async () => {
    const event = createMockEvent({ method: 'DELETE', params: { id: '1' } })
    await expect(deleteGuestHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('GET /api/admin/guests/export rejects an unauthenticated request with 401', async () => {
    const event = createMockEvent({ method: 'GET' })
    await expect(exportGuestsHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })
})
