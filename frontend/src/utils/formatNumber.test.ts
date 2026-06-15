import { describe, it, expect } from 'vitest'
import { formatNumber } from './formatNumber'

describe('formatNumber', () => {
  it('leaves values under 1,000 as-is', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
  })

  it('abbreviates thousands / millions / billions', () => {
    expect(formatNumber(1_500)).toBe('1.5K')
    expect(formatNumber(2_400_000)).toBe('2.4M')
    expect(formatNumber(3_000_000_000)).toBe('3.0B')
  })

  it('uses the largest applicable unit at boundaries', () => {
    expect(formatNumber(1_000)).toBe('1.0K')
    expect(formatNumber(1_000_000)).toBe('1.0M')
  })
})
