import { describe, it, expect } from 'vitest'
import { generateInviteCode } from '../../server/utils/inviteCode'

describe('generateInviteCode', () => {
  it('возвращает 10-символьный код из латиницы и цифр', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[A-Za-z0-9]{10}$/)
  })

  it('генерирует разные коды при повторных вызовах', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()))
    expect(codes.size).toBe(200)
  })
})
