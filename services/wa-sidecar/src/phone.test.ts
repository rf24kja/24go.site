import { describe, it, expect } from 'vitest'
import { validateE164, normalizePhone } from './index.js'

describe('validateE164', () => {
  it('accepts real production numbers', () => {
    expect(validateE164('+66920004002')).toBe(true)
    expect(validateE164('+79001234567')).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(validateE164('66920004002')).toBe(false)
    expect(validateE164('+0123')).toBe(false)
    expect(validateE164('+66 92 000 4002')).toBe(false)
    expect(validateE164('')).toBe(false)
    expect(validateE164('+1234567890123456')).toBe(false)
  })
})

describe('normalizePhone', () => {
  it('adds missing plus and strips separators', () => {
    expect(normalizePhone('66920004002')).toBe('+66920004002')
    expect(normalizePhone('+7 (900) 123-45-67')).toBe('+79001234567')
  })

  it('keeps valid input unchanged', () => {
    expect(normalizePhone('+66920004002')).toBe('+66920004002')
  })

  it('normalized output always passes validation when digits suffice', () => {
    expect(validateE164(normalizePhone('8 926 123-45-67'))).toBe(true)
  })
})
