import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSearchRows,
  buildSongRows,
  filterSearchGenres,
  pickTopSearchResult,
  SearchResultRow,
  type SearchRow,
} from './SearchPage'
import { useLibraryStore } from '@/stores/libraryStore'
import type { SearchResults } from '@/services/searchService'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { UserSearchResult } from '@/types/friend'
import type { Genre } from '@/types/genre'

// The row context menus pull in useIsMobile + Headless UI, neither of which jsdom
// provides an implementation for. Same stubs as TrackRowMenu.test.tsx.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

const artist: Artist = {
  id: 'artist-1',
  name: 'Neon Stars',
  bio: null,
  imageUrl: '/artist.jpg',
  headerImageUrl: null,
  monthlyListeners: 1000,
  genres: [],
  followerCount: 10,
  verified: true,
  socialLinks: {},
  createdAt: '2026-01-01T00:00:00Z',
}

const album: Album = {
  id: 'album-1',
  title: 'Neon Nights',
  type: 'album',
  coverUrl: '/album.jpg',
  releaseDate: '2026-01-01',
  totalTracks: 1,
  durationMs: 180000,
  artist: { id: artist.id, name: artist.name, imageUrl: artist.imageUrl },
  genres: [],
  label: null,
  copyright: null,
  popularity: 10,
}

const track: Track = {
  id: 'track-1',
  title: 'Neon',
  durationMs: 180000,
  audioUrl: '/track.mp3',
  previewUrl: null,
  trackNumber: 1,
  discNumber: 1,
  explicit: false,
  playCount: 0,
  ratingCount: 0,
  averageRating: 0,
  artist: { id: artist.id, name: artist.name, imageUrl: artist.imageUrl },
  album: { id: album.id, title: album.title, coverUrl: album.coverUrl, releaseDate: album.releaseDate, type: album.type },
  genres: [],
  createdAt: '2026-01-01T00:00:00Z',
}

const secondTrack: Track = { ...track, id: 'track-2', title: 'Afterglow' }
const lyricTrack: Track = { ...track, id: 'lyric-1', title: 'Hidden Line' }

const playlist: Playlist = {
  id: 'playlist-1',
  name: 'Neon Mix',
  description: null,
  coverUrl: '/playlist.jpg',
  isPublic: true,
  visibility: 'public',
  isFeatured: false,
  sortOrder: 0,
  owner: { id: 'user-1', name: 'Doreen', avatarUrl: null },
  tracks: [],
  followerCount: 1,
  totalDurationMs: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const video: MusicVideo = {
  id: 'video-1',
  title: 'Neon Video',
  description: null,
  artist: { id: artist.id, name: artist.name, imageUrl: artist.imageUrl },
  trackId: track.id,
  videoUrl: '/video.mp4',
  thumbnailUrl: '/video.jpg',
  durationMs: 180000,
  viewCount: 20,
  createdAt: '2026-01-01T00:00:00Z',
}

const podcast: PodcastSummary = {
  id: 'podcast-1',
  title: 'Neon Talks',
  author: 'NotSpotify',
  description: null,
  category: 'Music',
  imageUrl: '/podcast.jpg',
  episodeCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
}

const profile: UserSearchResult = {
  id: 'profile-1',
  name: 'Neon Listener',
  email: 'neon@example.com',
  avatarUrl: null,
  mutualFriendsCount: 0,
  isArtist: false,
}

const genres: Genre[] = [
  { id: 'genre-1', name: 'Taiwan 10-year anniversary', slug: 'taiwan-10-year-anniversary', color: '#123456', imageUrl: null },
  { id: 'genre-2', name: 'Mandopop', slug: 'mandopop', color: '#654321', imageUrl: null },
]

function results(overrides: Partial<SearchResults> = {}): SearchResults {
  return {
    tracks: [track, secondTrack],
    artists: [artist],
    albums: [album],
    playlists: [playlist],
    musicVideos: [video],
    podcasts: [podcast],
    profiles: [profile],
    tracksByLyrics: [lyricTrack],
    ...overrides,
  }
}

function renderRows(rows: SearchRow[]) {
  return render(
    <MemoryRouter>
      <div>
        {rows.map((row) => (
          <SearchResultRow key={`${row.kind}-${row.id}`} row={row} />
        ))}
      </div>
    </MemoryRouter>,
  )
}

describe('SearchPage result helpers', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      likedTrackIds: new Set(),
      followedArtistIds: new Set(),
      savedAlbumIds: new Set(),
      savedVideoIds: new Set(),
      savedPodcastIds: new Set(),
    })
  })

  it('picks a deterministic top result with tracks ahead of other exact matches', () => {
    expect(pickTopSearchResult(results(), 'Neon')).toMatchObject({ kind: 'track', id: track.id })
  })

  it('interleaves All results and narrows filtered tabs', () => {
    expect(buildSearchRows(results(), 'all').map((row) => row.kind)).toEqual([
      'track',
      'artist',
      'album',
      'musicVideo',
      'playlist',
      'podcast',
      'profile',
      'track',
    ])
    expect(buildSearchRows(results(), 'playlists').map((row) => row.kind)).toEqual(['playlist'])
    expect(buildSongRows(results()).map((row) => row.kind)).toEqual(['track', 'musicVideo', 'track', 'lyrics'])
    expect(filterSearchGenres(genres, 'taiwan').map((genre) => genre.name)).toEqual(['Taiwan 10-year anniversary'])
  })

  it('renders row badges and contextual actions for songs, artists, and videos', () => {
    renderRows([
      { kind: 'track', id: track.id, item: track },
      { kind: 'artist', id: artist.id, item: artist },
      { kind: 'musicVideo', id: video.id, item: video },
      { kind: 'lyrics', id: lyricTrack.id, item: lyricTrack },
    ])

    expect(screen.getByText('Song')).toBeInTheDocument()
    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0)
    expect(screen.getByText('Music video')).toBeInTheDocument()
    // The lyric match renders with its own badge and title (the "Found in
    // lyrics" section in the All tab is built from these rows).
    expect(screen.getByText('Lyrics match')).toBeInTheDocument()
    expect(screen.getByText('Hidden Line')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Save to library' })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument()
  })

  it('links the artist name in a result subtitle to the artist page', () => {
    renderRows([
      { kind: 'track', id: track.id, item: track },
      { kind: 'album', id: album.id, item: album },
      { kind: 'musicVideo', id: video.id, item: video },
    ])

    // One link per row subtitle, all pointing at the artist rather than the row's
    // own destination (track/album/video page).
    const links = screen.getAllByRole('link', { name: artist.name })
    expect(links).toHaveLength(3)
    for (const link of links) expect(link).toHaveAttribute('href', `/artist/${artist.id}`)
  })

  it('does not let the artist link hijack the row drag', () => {
    // The row is draggable; a bare <a> is natively draggable too and would otherwise
    // start its own drag carrying just a URL.
    renderRows([{ kind: 'track', id: track.id, item: track }])

    expect(screen.getByRole('link', { name: artist.name })).toHaveAttribute('draggable', 'false')
  })

  it('makes result rows draggable with the shared content MIME types', () => {
    const cases: Array<{ row: SearchRow; mime: string; id: string }> = [
      { row: { kind: 'track', id: track.id, item: track }, mime: 'application/x-notspotify-track', id: track.id },
      { row: { kind: 'artist', id: artist.id, item: artist }, mime: 'application/x-notspotify-artist', id: artist.id },
      { row: { kind: 'album', id: album.id, item: album }, mime: 'application/x-notspotify-album', id: album.id },
      { row: { kind: 'musicVideo', id: video.id, item: video }, mime: 'application/x-notspotify-video', id: video.id },
    ]

    for (const { row, mime, id } of cases) {
      const { unmount } = renderRows([row])
      const el = screen.getAllByRole('button')[0]
      expect(el).toHaveAttribute('draggable', 'true')

      const data: Record<string, string> = {}
      fireEvent.dragStart(el, {
        dataTransfer: {
          setData: (type: string, value: string) => { data[type] = value },
          setDragImage: () => {},
          effectAllowed: '',
        },
      })

      // Same payload shape the cards use, so existing drop targets need no changes.
      expect(data[mime]).toBe(id)
      expect(data['text/plain']).toBeTruthy()
      unmount()
    }
  })

  it('opens a context menu on right-click for each content kind', () => {
    const cases: Array<{ row: SearchRow; item: string }> = [
      { row: { kind: 'track', id: track.id, item: track }, item: 'Add to queue' },
      { row: { kind: 'artist', id: artist.id, item: artist }, item: 'Go to artist' },
      { row: { kind: 'album', id: album.id, item: album }, item: 'Go to album' },
    ]

    for (const { row } of cases) {
      const { unmount } = renderRows([row])
      const el = screen.getAllByRole('button')[0]

      // Nothing open until the row is right-clicked.
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      fireEvent.contextMenu(el)
      expect(screen.getByRole('menu')).toBeInTheDocument()

      unmount()
    }
  })

  it('leaves profiles without a menu (the app has no profile menu to reuse)', () => {
    renderRows([{ kind: 'profile', id: profile.id, item: profile }])

    fireEvent.contextMenu(screen.getAllByRole('button')[0])

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('leaves playlists and profiles undraggable (nothing accepts them as a drop)', () => {
    renderRows([
      { kind: 'playlist', id: playlist.id, item: playlist },
      { kind: 'profile', id: profile.id, item: profile },
    ])

    for (const el of screen.getAllByRole('button')) {
      expect(el).not.toHaveAttribute('draggable', 'true')
    }
  })
})
