import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
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
})
