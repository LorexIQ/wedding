import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../server/utils/password'

describe('password hashing', () => {
  it('verifies correct password', () => {
    const hash = hashPassword('supersecret123')
    expect(verifyPassword('supersecret123', hash)).toBe(true)
  })

  it('rejects wrong password', () => {
    const hash = hashPassword('supersecret123')
    expect(verifyPassword('wrongpass', hash)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', () => {
    const hash1 = hashPassword('supersecret123')
    const hash2 = hashPassword('supersecret123')
    expect(hash1).not.toBe(hash2)
  })
})
