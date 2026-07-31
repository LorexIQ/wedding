import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { createMockEvent } from '../../helpers/mockEvent'
import { guests } from '../../../server/database/schema'
import inviteGetHandler, { resolveInvite } from '../../../server/api/invite/[code].get'

function seedInvite(testDb: ReturnType<typeof createTestDb>) {
  const now = new Date()
  testDb.insert(guests).values({
    fio: 'Иванов Иван', phone: '+79990000000', comment: null, drinks: ['red_dry'],
    inviteCode: 'ABC1234567', submitted: false, envelopeOpened: false,
    createdAt: now, updatedAt: now
  }).run()
}

describe('resolveInvite', () => {
  it('находит гостя по коду', () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const guest = resolveInvite('ABC1234567', testDb)
    expect(guest?.fio).toBe('Иванов Иван')
    expect(guest?.submitted).toBe(false)
  })

  it('возвращает null для неизвестного кода', () => {
    const testDb = createTestDb()
    const guest = resolveInvite('NOPE000000', testDb)
    expect(guest).toBeNull()
  })
})

describe('GET /api/invite/:code — rate limiting', () => {
  it('отвечает 429 после превышения лимита запросов с одного IP', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`

    // No `code` param means each call fails fast with 400 (never touches the DB),
    // which is enough to exercise the rate limiter without needing a seeded guest.
    for (let i = 0; i < 20; i += 1) {
      const event = createMockEvent({ headers: { 'cf-connecting-ip': ip } })
      await expect(inviteGetHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    }

    const blockedEvent = createMockEvent({ headers: { 'cf-connecting-ip': ip } })
    await expect(inviteGetHandler(blockedEvent)).rejects.toMatchObject({ statusCode: 429 })
  })
})

import openHandler, { markEnvelopeOpened } from '../../../server/api/invite/[code]/open.post'

describe('markEnvelopeOpened', () => {
  it('проставляет envelopeOpened=true по коду', () => {
    const testDb = createTestDb()
    seedInvite(testDb)

    const ok = markEnvelopeOpened('ABC1234567', testDb)
    expect(ok).toBe(true)

    const guest = resolveInvite('ABC1234567', testDb)
    expect(guest?.envelopeOpened).toBe(true)
  })

  it('возвращает null для неизвестного кода, ничего не меняя', () => {
    const testDb = createTestDb()
    const ok = markEnvelopeOpened('NOPE000000', testDb)
    expect(ok).toBeNull()
  })
})

describe('POST /api/invite/:code/open — rate limiting', () => {
  it('отвечает 429 после превышения лимита запросов с одного IP', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`

    // No `code` param means each call fails fast with 400 (never touches the DB),
    // which is enough to exercise the rate limiter without needing a seeded guest.
    for (let i = 0; i < 20; i += 1) {
      const event = createMockEvent({ method: 'POST', headers: { 'cf-connecting-ip': ip } })
      await expect(openHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    }

    const blockedEvent = createMockEvent({ method: 'POST', headers: { 'cf-connecting-ip': ip } })
    await expect(openHandler(blockedEvent)).rejects.toMatchObject({ statusCode: 429 })
  })
})
