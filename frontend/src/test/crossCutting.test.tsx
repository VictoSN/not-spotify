import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Track } from '@/types/track'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'

// ---------------------------------------------------------------------------
// Phase 11 — cross-cutting test hardening.
//
// A single regression net that exercises behaviour that otherwise lives in
// separate per-phase suites, so a change in one store/component that quietly
// breaks another surface fails here too:
//   1. Player state machine: audio ↔ MV ↔ ad transitions never overlap and
//      keep playbackMode + the now-playing panel in sync. (Phases 1, 4, 5)
//   2. Library/recents registration across media types: track, MV, podcast.
//      (Phases 1, 2)
//   3. Recommendation/genre "Show all" routing resolves to real pages, never a
//      name→search query. (Phase 4)
//   4. Home clickability: cards navigate; nested controls don't. (Phase 15)
//   5. Playlist add-track hover affordance adds exactly once. (Phase 16)
// ---------------------------------------------------------------------------

// The player store records plays and fetches ads as side effects; mock the
// services so the state machine runs offline and synchronously-ish.
vi.mock('@/services/trackService', () => ({
  trackService: {
    recordPlay: vi.fn(() => Promise.resolve()),
    getRadio: vi.fn(() => Promise.resolve([])),
  },
}))
const getNext = vi.fn(() => Promise.resolve<unknown>(null))
vi.mock('@/services/adService', () => ({
  adService: {
    getSettings: vi.fn(() => Promise.resolve({ adsPerNTracks: 3, isEnabled: true })),
    getNext: (...args: unknown[]) => getNext(...(args as [])),
  },
}))

import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { trackService } from '@/services/trackService'
import { selectNowPlayingPanel } from '@/components/player/selectNowPlayingPanel'
import { curatedBrowseCategories, getBrowseFallbackRows } from '@/data/browseContent'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { MixTile } from '@/components/cards/MixTile'
import { PlaylistAddableRow } from '@/components/player/PlaylistAddableRow'
import type { Playlist } from '@/types/playlist'
import type { DailyMix } from '@/services/trackService'

const track = (id: string): Track =>
  ({
    id,
    title: `Track ${id}`,
    durationMs: 180_000,
    audioUrl: `audio/${id}.mp3`,
    artist: { id: `artist-${id}`, name: 'Artist', imageUrl: null },
    album: { id: `album-${id}`, title: 'Album', coverUrl: '', releaseDate: '2020-01-01', type: 'album' },
    genres: [],
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    createdAt: '2020-01-01',
  }) as unknown as Track

const video = (id: string): MusicVideo => ({
  id,
  title: `Video ${id}`,
  description: null,
  artist: { id: `artist-${id}`, name: 'Artist', imageUrl: null },
  trackId: null,
  videoUrl: `video/${id}.mp4`,
  thumbnailUrl: null,
  durationMs: 120_000,
  viewCount: 10,
  createdAt: '2020-01-01',
})

const podcast = (id: string): PodcastSummary => ({
  id,
  title: `Podcast ${id}`,
  author: 'Host',
  description: null,
  category: null,
  imageUrl: null,
  episodeCount: 3,
  createdAt: '2020-01-01',
})

const setFree = () =>
  useAuthStore.setState({ isAuthenticated: true, user: { capabilities: { unlimitedPlayback: false } } as never })
const setPremium = () =>
  useAuthStore.setState({ isAuthenticated: true, user: { capabilities: { unlimitedPlayback: true } } as never })

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  getNext.mockClear()
  getNext.mockResolvedValue(null)
  vi.mocked(trackService.recordPlay).mockClear()
  localStorage.clear()
  // Logged-out transition fires the store subscribers that reset the module-scoped
  // ad counters between tests.
  useAuthStore.setState({ isAuthenticated: false, user: null })
  usePlayerStore.setState({
    playbackMode: 'audio',
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentVideo: null,
    isVideoPlaying: false,
    videoQueue: [],
    videoQueueIndex: -1,
    queue: [],
    queueIndex: -1,
    history: [],
    currentAd: null,
  })
  useLibraryStore.setState({
    savedVideos: [],
    savedVideoIds: new Set(),
    savedPodcasts: [],
    savedPodcastIds: new Set(),
  })
})

describe('cross-cutting · player state machine (audio ↔ MV ↔ ad)', () => {
  it('switching audio → MV tears down audio playback and selects the MV panel', () => {
    setPremium()
    usePlayerStore.getState().play(track('song'))
    expect(selectNowPlayingPanel(usePlayerStore.getState().playbackMode)).toBe('audio')

    usePlayerStore.getState().playVideo(video('mv1'))
    const s = usePlayerStore.getState()
    // No overlap: audio deck is cleared while the MV plays.
    expect(s.playbackMode).toBe('video')
    expect(s.currentTrack).toBeNull()
    expect(s.isPlaying).toBe(false)
    expect(s.currentVideo?.id).toBe('mv1')
    expect(s.isVideoPlaying).toBe(true)
    expect(selectNowPlayingPanel(s.playbackMode)).toBe('video')
  })

  it('switching MV → audio tears down the video deck and selects the audio panel', () => {
    setPremium()
    usePlayerStore.getState().playVideo(video('mv1'))
    usePlayerStore.getState().play(track('song'))
    const s = usePlayerStore.getState()
    expect(s.playbackMode).toBe('audio')
    expect(s.currentVideo).toBeNull()
    expect(s.isVideoPlaying).toBe(false)
    expect(s.currentTrack?.id).toBe('song')
    expect(s.isPlaying).toBe(true)
    expect(selectNowPlayingPanel(s.playbackMode)).toBe('audio')
  })

  it('a free-tier ad pauses the song (no double audio) and endAd resumes it', async () => {
    setFree()
    getNext.mockResolvedValue({ id: 'ad1', title: 'Ad' } as never)
    const q = Array.from({ length: 10 }, (_, i) => track(`t${i}`))
    usePlayerStore.getState().play(q[0], q)
    // Default cadence 3 → the 4th advance is ad-time.
    for (let i = 0; i < 4; i++) usePlayerStore.getState().skipNext()
    await flush()

    let s = usePlayerStore.getState()
    expect(s.currentAd).toEqual({ id: 'ad1', title: 'Ad' })
    expect(s.isPlaying).toBe(false) // song is held, not playing under the ad
    expect(s.playbackMode).toBe('audio') // audio surface stays mounted during the ad

    usePlayerStore.getState().endAd()
    s = usePlayerStore.getState()
    expect(s.currentAd).toBeNull()
    expect(s.isPlaying).toBe(true)
  })

  it('starting an MV cancels a playing ad so the two never sound together', () => {
    setFree()
    usePlayerStore.setState({ currentTrack: track('a'), currentAd: { id: 'ad1' } as never, isPlaying: false })
    usePlayerStore.getState().playVideo(video('mv1'))
    const s = usePlayerStore.getState()
    expect(s.currentAd).toBeNull()
    expect(s.playbackMode).toBe('video')
    expect(s.currentVideo?.id).toBe('mv1')
  })
})

describe('cross-cutting · library/recents registration across media types', () => {
  it('records plays / saves for an authed user across track, MV, and podcast', () => {
    setPremium()
    // Unique id: recordPlay dedupes within a 5s window via a module-scoped map
    // that survives across tests, so reusing a common id would no-op here.
    usePlayerStore.getState().play(track('reg-song'))
    // Standalone plays record without a queue context.
    expect(trackService.recordPlay).toHaveBeenCalledWith('reg-song', null)

    usePlayerStore.getState().playVideo(video('mv1'))
    // savedVideos doubles as the MV recents list — most-recent-first.
    const lib1 = useLibraryStore.getState()
    expect(lib1.savedVideoIds.has('mv1')).toBe(true)
    expect(lib1.savedVideos[0]?.id).toBe('mv1')

    useLibraryStore.getState().savePodcast(podcast('pod1'))
    const lib2 = useLibraryStore.getState()
    expect(lib2.savedPodcastIds.has('pod1')).toBe(true)
    expect(lib2.savedPodcasts[0]?.id).toBe('pod1')
  })

  it('gates the MV library side effect for guests but still plays the video', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null })
    usePlayerStore.getState().playVideo(video('mv-guest'))
    expect(usePlayerStore.getState().playbackMode).toBe('video')
    expect(useLibraryStore.getState().savedVideoIds.has('mv-guest')).toBe(false)
  })
})

describe('cross-cutting · recommendation/genre "Show all" routing', () => {
  it('never points a curated discover card at a name→search query', () => {
    const items = curatedBrowseCategories.flatMap((c) => c.rows ?? []).flatMap((r) => r.items)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) expect(item.href ?? '').not.toMatch(/\/search/)
  })

  it('maps the canonical discover playlists to real track-list routes', () => {
    const discover = curatedBrowseCategories.find((c) => c.slug === 'music')?.rows?.[0]
    const hrefOf = (title: string) => discover?.items.find((i) => i.title === title)?.href
    expect(hrefOf('New Music Friday')).toBe('/new-releases')
    expect(hrefOf('Discover Weekly')).toBe('/recommended-tracks')
    expect(discover?.href).toBe('/new-releases')
  })

  it('routes generated fallback showcase rows to the genre page, not a search', () => {
    const rows = getBrowseFallbackRows('rock', 'Rock')
    expect(rows[0].href).toBe('/genres/rock')
    for (const item of rows.flatMap((r) => r.items)) expect(item.href).toBe('/genres/rock')
  })
})

const playlist: Playlist = {
  id: 'cc-playlist',
  name: 'Cross Cutting Playlist',
  description: null,
  coverUrl: '/pl.jpg',
  isPublic: true,
  owner: { id: 'u', name: 'Owner', avatarUrl: null },
  tracks: [],
  followerCount: 0,
  totalDurationMs: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mix: DailyMix = { id: 'cc-mix', title: 'Cross Cutting Mix', subtitle: 'Daily Mix', color: '#1db954', tracks: [] }

function RouteProbe() {
  return <output aria-label="current route">{useLocation().pathname}</output>
}

describe('cross-cutting · clickability & add-track affordance', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true })
  })

  it('navigates from playlist/mix cards but not from their nested play control', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PlaylistCard playlist={playlist} />
        <MixTile mix={mix} />
        <RouteProbe />
      </MemoryRouter>,
    )
    const route = () => screen.getByRole('status', { name: 'current route' })

    // Nested play button must not navigate the card.
    fireEvent.click(screen.getByRole('button', { name: `Play ${mix.title}` }))
    expect(route()).toHaveTextContent('/')

    fireEvent.click(screen.getByText(playlist.name))
    expect(route()).toHaveTextContent(`/playlist/${playlist.id}`)
  })

  it('adds a track exactly once from the in-cover hover/focus affordance', () => {
    const onAdd = vi.fn(() => new Promise<void>(() => {}))
    render(
      <MemoryRouter>
        <PlaylistAddableRow track={track('add1')} onAdd={onAdd} />
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: `Add ${track('add1').title} to this playlist` })
    // The action lives over the cover artwork.
    expect(button.parentElement).toContainElement(screen.getByRole('img', { name: 'Album' }))
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
