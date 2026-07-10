import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomPlayerBar } from './BottomPlayerBar'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { Track } from '@/types/track'

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => true,
}))

vi.mock('@/hooks/useDominantColor', () => ({
  useDominantColor: () => null,
}))

vi.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function track(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    durationMs: 180_000,
    audioUrl: `/audio/${id}.mp3`,
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    artist: { id: 'artist-1', name: 'Artist', imageUrl: null },
    album: {
      id: 'album-1',
      title: 'Album',
      coverUrl: `/covers/${id}.jpg`,
      releaseDate: '2026-01-01',
      type: 'album',
    },
    genres: [],
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function renderPlayer() {
  return render(
    <MemoryRouter>
      <BottomPlayerBar />
    </MemoryRouter>,
  )
}

function setCardWidth(card: HTMLElement, width = 360) {
  Object.defineProperty(card, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 8,
      y: 0,
      top: 0,
      right: 8 + width,
      bottom: 66,
      left: 8,
      width,
      height: 66,
      toJSON: () => ({}),
    }),
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  useLibraryStore.setState({ likedTrackIds: new Set() })
  usePlayerStore.setState({
    playbackMode: 'audio',
    currentTrack: track('one'),
    currentVideo: null,
    isPlaying: false,
    isVideoPlaying: false,
    currentTime: 0,
    duration: 180,
    isNowPlayingOpen: true,
    isMobileNowPlayingOpen: false,
    setMobileNowPlayingOpen: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  })
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('BottomPlayerBar mobile swipe dismissal', () => {
  it('slides away on a right swipe, keeps playback loaded, and returns for the next item', () => {
    renderPlayer()
    const card = screen.getByTestId('mobile-mini-player')
    setCardWidth(card)

    fireEvent.pointerDown(card, { pointerId: 7, button: 0, isPrimary: true, clientX: 12, clientY: 30 })
    fireEvent.pointerMove(card, { pointerId: 7, clientX: 145, clientY: 32 })

    expect(card.style.transform).toBe('translate3d(133px, 0px, 0)')

    fireEvent.pointerUp(card, { pointerId: 7, clientX: 145, clientY: 32 })
    expect(screen.getByTestId('mobile-mini-player')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(220))
    expect(screen.queryByTestId('mobile-mini-player')).not.toBeInTheDocument()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('one')

    act(() => usePlayerStore.setState({ currentTime: 42 }))
    expect(screen.queryByTestId('mobile-mini-player')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mobile-mini-player-restore'))
    expect(screen.getByTestId('mobile-mini-player')).toBeInTheDocument()

    act(() => usePlayerStore.setState({ currentTrack: track('two') }))
    expect(screen.getByTestId('mobile-mini-player')).toBeInTheDocument()
    expect(screen.getByText('Track two')).toBeInTheDocument()
  })

  it('snaps a short swipe back and suppresses only its accidental row click', () => {
    renderPlayer()
    const card = screen.getByTestId('mobile-mini-player')
    const row = screen.getByRole('button', { name: 'player.openNowPlaying' })
    const setMobileNowPlayingOpen = usePlayerStore.getState().setMobileNowPlayingOpen as ReturnType<typeof vi.fn>
    setCardWidth(card)

    fireEvent.pointerDown(card, { pointerId: 8, button: 0, isPrimary: true, clientX: 12, clientY: 30 })
    fireEvent.pointerMove(card, { pointerId: 8, clientX: 36, clientY: 31 })
    fireEvent.pointerUp(card, { pointerId: 8, clientX: 36, clientY: 31 })
    fireEvent.click(row)

    expect(card.style.transform).toBe('translate3d(0px, 0px, 0)')
    expect(screen.getByTestId('mobile-mini-player')).toBeInTheDocument()
    expect(setMobileNowPlayingOpen).not.toHaveBeenCalled()

    fireEvent.click(row)
    expect(setMobileNowPlayingOpen).toHaveBeenCalledWith(true)
  })

  it('does not hijack a vertical page swipe', () => {
    renderPlayer()
    const card = screen.getByTestId('mobile-mini-player')
    setCardWidth(card)

    fireEvent.pointerDown(card, { pointerId: 9, button: 0, isPrimary: true, clientX: 40, clientY: 20 })
    fireEvent.pointerMove(card, { pointerId: 9, clientX: 46, clientY: 100 })
    fireEvent.pointerUp(card, { pointerId: 9, clientX: 46, clientY: 100 })
    act(() => vi.advanceTimersByTime(300))

    expect(screen.getByTestId('mobile-mini-player')).toBeInTheDocument()
    expect(card.style.transform).toBe('translate3d(0px, 0px, 0)')
  })

  it('opens the mobile sheet on swipe up without changing the desktop sidebar preference', () => {
    renderPlayer()
    const card = screen.getByTestId('mobile-mini-player')
    const setMobileNowPlayingOpen = usePlayerStore.getState().setMobileNowPlayingOpen as ReturnType<typeof vi.fn>
    setCardWidth(card)

    fireEvent.pointerDown(card, { pointerId: 10, button: 0, isPrimary: true, clientX: 120, clientY: 58 })
    fireEvent.pointerMove(card, { pointerId: 10, clientX: 118, clientY: 8 })
    expect(card.style.transform).toBe('translate3d(0px, -50px, 0)')
    fireEvent.pointerUp(card, { pointerId: 10, clientX: 118, clientY: 8 })

    expect(setMobileNowPlayingOpen).toHaveBeenCalledWith(true)
    expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true)
  })
})
