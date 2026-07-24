import { describe, expect, it } from 'vitest'
import {
  buildHandoffPath,
  isSafeReturnPath,
  maskEmail,
  parseHandoffHint,
  safeReturnPath,
} from './accountHandoff'

describe('maskEmail', () => {
  it('keeps the first character and the domain, hides the rest', () => {
    expect(maskEmail('nomnom@nugget.com')).toBe('n••••@nugget.com')
  })
  it('never returns the full local part', () => {
    expect(maskEmail('alexander@example.com')).not.toContain('alexander')
  })
  it('falls back to a neutral label for missing or malformed input', () => {
    expect(maskEmail(null)).toBe('another account')
    expect(maskEmail('')).toBe('another account')
    expect(maskEmail('not-an-email')).toBe('another account')
    expect(maskEmail('@nodomain')).toBe('another account')
  })
})

describe('isSafeReturnPath', () => {
  it('accepts internal allow-listed paths', () => {
    for (const p of ['/', '/account', '/account/family', '/support', '/download/windows', '/handoff?acct=x']) {
      expect(isSafeReturnPath(p)).toBe(true)
    }
  })
  it('rejects open-redirect and scheme attempts', () => {
    for (const p of [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'http://evil.com',
      '/javascript:alert(1)',
      'javascript:alert(1)',
      'data:text/html,x',
      'evil.com',
      '',
      null,
      undefined,
    ]) {
      expect(isSafeReturnPath(p as string)).toBe(false)
    }
  })
  it('rejects internal paths that are not on the allow-list', () => {
    expect(isSafeReturnPath('/admin/dashboard')).toBe(false)
    expect(isSafeReturnPath('/etc/passwd')).toBe(false)
  })
  it('rejects control characters', () => {
    expect(isSafeReturnPath('/account\n/x')).toBe(false)
  })
})

describe('safeReturnPath', () => {
  it('passes safe paths through and coerces unsafe ones to root', () => {
    expect(safeReturnPath('/account')).toBe('/account')
    expect(safeReturnPath('//evil.com')).toBe('/')
    expect(safeReturnPath(null)).toBe('/')
  })
})

describe('buildHandoffPath', () => {
  it('includes the expected account id and a MASKED email only', () => {
    const path = buildHandoffPath('/account', { id: 'user-b-id', email: 'bob@example.com' })
    const q = new URLSearchParams(path.split('?')[1])
    expect(path.startsWith('/handoff?')).toBe(true)
    expect(q.get('acct')).toBe('user-b-id')
    expect(q.get('next')).toBe('/account')
    // never the raw email
    expect(path).not.toContain('bob@example.com')
    expect(q.get('hint')).toBe('b••@example.com')
  })
  it('omits the account hint when there is no user', () => {
    const path = buildHandoffPath('/support', null)
    const q = new URLSearchParams(path.split('?')[1])
    expect(q.get('acct')).toBeNull()
    expect(q.get('hint')).toBeNull()
    expect(q.get('next')).toBe('/support')
  })
})

describe('parseHandoffHint', () => {
  it('reads the hint and sanitises next', () => {
    const h = parseHandoffHint('acct=abc&hint=n%E2%80%A2%E2%80%A2%40x.com&next=%2Faccount')
    expect(h.account).toBe('abc')
    expect(h.next).toBe('/account')
  })
  it('coerces a malicious next to root', () => {
    expect(parseHandoffHint('next=%2F%2Fevil.com').next).toBe('/')
  })
})
