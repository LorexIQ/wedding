import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit } from '../../server/utils/rateLimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('allows up to the limit then blocks', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true)
    }
    expect(checkRateLimit(key, 5, 60_000)).toBe(false)
  })

  it('resets after the window passes', () => {
    vi.useFakeTimers()
    const key = `test-window-${Math.random()}`
    expect(checkRateLimit(key, 1, 1000)).toBe(true)
    expect(checkRateLimit(key, 1, 1000)).toBe(false)
    vi.advanceTimersByTime(1001)
    expect(checkRateLimit(key, 1, 1000)).toBe(true)
    vi.useRealTimers()
  })
})
