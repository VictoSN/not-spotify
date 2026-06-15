import { describe, it, expect } from 'vitest'
import { formatSeconds, formatMs } from './formatTime'

describe('formatSeconds', () => {
  it('formats as m:ss with a zero-padded seconds field', () => {
    expect(formatSeconds(0)).toBe('0:00')
    expect(formatSeconds(5)).toBe('0:05')
    expect(formatSeconds(65)).toBe('1:05')
    expect(formatSeconds(600)).toBe('10:00')
  })

  it('floors fractional seconds', () => {
    expect(formatSeconds(59.9)).toBe('0:59')
  })
})

describe('formatMs', () => {
  it('converts milliseconds to m:ss', () => {
    expect(formatMs(65_000)).toBe('1:05')
    expect(formatMs(224_000)).toBe('3:44')
  })
})
