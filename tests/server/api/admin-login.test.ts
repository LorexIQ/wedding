import { describe, it, expect } from 'vitest'
import { createTestDb } from '../../helpers/testDb'
import { adminUsers } from '../../../server/database/schema'
import { hashPassword } from '../../../server/utils/password'
import { authenticateAdmin } from '../../../server/api/admin/login.post'

describe('authenticateAdmin', () => {
  it('returns admin id for correct credentials', async () => {
    const testDb = createTestDb()
    testDb.insert(adminUsers).values({ login: 'bride', passwordHash: hashPassword('secret123') }).run()

    const result = await authenticateAdmin('bride', 'secret123', testDb)
    expect(result).toEqual({ id: 1 })
  })

  it('returns null for wrong password', async () => {
    const testDb = createTestDb()
    testDb.insert(adminUsers).values({ login: 'bride', passwordHash: hashPassword('secret123') }).run()

    const result = await authenticateAdmin('bride', 'wrongpass', testDb)
    expect(result).toBeNull()
  })

  it('returns null for unknown login', async () => {
    const testDb = createTestDb()
    const result = await authenticateAdmin('ghost', 'secret123', testDb)
    expect(result).toBeNull()
  })
})
