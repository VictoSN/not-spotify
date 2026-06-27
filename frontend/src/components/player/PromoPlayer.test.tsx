import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PromoPlayer } from './PromoPlayer'
import { usePlayerStore } from '@/stores/playerStore'

vi.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => (key === 'ad.label' ? 'Ad' : key) }),
}))

const recordImpression = vi.fn(() => Promise.resolve())
vi.mock('@/services/adService', () => ({
  adService: {
    recordImpression: (...args: unknown[]) => recordImpression(...args),
  },
}))

const baseAd = {
  id: 'ad-1',
  title: 'House ad',
  advertiser: 'not-spotify',
  audioUrl: null,
  clickUrl: null,
  imageUrl: null,
  durationMs: 2_000,
}

function renderPromo() {
  return render(
    <MemoryRouter>
      <PromoPlayer />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  recordImpression.mockClear()
  usePlayerStore.setState({
    currentAd: null,
    isPlaying: false,
    volume: 0.8,
    isMuted: false,
  })
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('PromoPlayer', () => {
  it('counts a fallback-timed ad down to zero and ends it once', () => {
    const endAd = vi.fn(() => usePlayerStore.setState({ currentAd: null }))
    usePlayerStore.setState({ currentAd: baseAd, endAd } as never)

    renderPromo()

    expect(screen.getByText('2s')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('1s')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(endAd).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('House ad')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(2_000))
    expect(endAd).toHaveBeenCalledTimes(1)
  })

  it('resets the countdown and clears the first timer when a second ad starts', () => {
    const endAd = vi.fn(() => usePlayerStore.setState({ currentAd: null }))
    usePlayerStore.setState({ currentAd: baseAd, endAd } as never)

    renderPromo()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('1s')).toBeInTheDocument()

    act(() => {
      usePlayerStore.setState({
        currentAd: {
          ...baseAd,
          id: 'ad-2',
          title: 'Second ad',
          durationMs: 4_000,
        },
      })
    })

    expect(screen.getByText('4s')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('3s')).toBeInTheDocument()
    expect(endAd).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(3_000))
    expect(endAd).toHaveBeenCalledTimes(1)
  })
})
