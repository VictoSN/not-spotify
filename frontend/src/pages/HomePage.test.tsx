import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage, HomePodcastTile, HomeQuickPlaylist, HomeVideoTile, getHomeFilterVisibility } from './HomePage'
import { useDragStore } from '@/stores/dragStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useHueStore } from '@/stores/hueStore'
import { PODCAST_DND_MIME, VIDEO_DND_MIME } from '@/utils/trackDnd'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { Playlist } from '@/types/playlist'
import type { DailyMix } from '@/services/trackService'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const dominantColorMock = vi.hoisted(() => vi.fn(() => Promise.resolve('hsl(280 42% 38%)')))

vi.mock('@/hooks/useDominantColor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useDominantColor')>()),
  getDominantColor: dominantColorMock,
}))

const mockVideo = vi.hoisted(() => ({
  id: 'video-1',
  title: 'Back to Friends',
  description: null,
  artist: { id: 'artist-1', name: 'sombr', imageUrl: null },
  trackId: null,
  videoUrl: '/video.mp4',
  thumbnailUrl: '/video.jpg',
  durationMs: 123000,
  viewCount: 10,
  createdAt: '2026-01-01T00:00:00Z',
}))

const dailyMixesMock = vi.hoisted(() => vi.fn(() => Promise.resolve([] as DailyMix[])))

vi.mock('@/services/trackService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/trackService')>()
  return {
    ...actual,
    trackService: {
      getForYou: vi.fn(() => Promise.resolve([])),
      getTrending: vi.fn(() => Promise.resolve([])),
      getRecents: vi.fn(() => Promise.resolve([])),
      getMostLiked: vi.fn(() => Promise.resolve([])),
      getNewMusic: vi.fn(() => Promise.resolve([])),
      getDailyMixes: dailyMixesMock,
      getPopularInCountry: vi.fn(() => Promise.resolve([])),
    },
  }
})

vi.mock('@/services/playlistService', () => ({
  playlistService: {
    getRecommended: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@/services/albumService', () => ({
  albumService: {
    getNewReleases: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@/services/artistService', () => ({
  artistService: {
    getPopular: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@/services/podcastService', () => ({
  podcastService: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@/services/videoService', () => ({
  videoService: {
    list: vi.fn(() => Promise.resolve([mockVideo])),
  },
}))

const video: MusicVideo = mockVideo

const podcast: PodcastSummary = {
  id: 'podcast-1',
  title: 'Night Drive',
  author: 'NotSpotify',
  description: null,
  category: 'Music',
  imageUrl: '/podcast.jpg',
  episodeCount: 4,
  createdAt: '2026-01-01T00:00:00Z',
}

const playlist: Playlist = {
  id: 'playlist-1',
  name: 'Home Playlist',
  description: null,
  coverUrl: '/playlist.jpg',
  isPublic: true,
  owner: { id: 'owner-1', name: 'Owner', imageUrl: null },
  tracks: [],
  followerCount: 0,
  totalDurationMs: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const dailyMixes: DailyMix[] = [
  { id: 'mix-first', title: 'First Daily Mix', subtitle: 'Daily Mix', color: '#1db954', tracks: [] },
  { id: 'mix-second', title: 'Second Daily Mix', subtitle: 'Daily Mix', color: '#6b4ce6', tracks: [] },
]

function dataTransfer() {
  return {
    effectAllowed: '',
    setData: vi.fn(),
    setDragImage: vi.fn(),
  }
}

describe('Home media interactions', () => {
  beforeEach(() => {
    window.localStorage.clear()
    dailyMixesMock.mockResolvedValue([])
    usePlayerStore.setState({ currentContextType: null, currentContextId: null, isPlaying: false })
    useDragStore.setState({
      draggedTrack: null,
      draggedArtist: null,
      draggedAlbum: null,
      draggedVideo: null,
      draggedPodcast: null,
    })
    useHueStore.setState({ hoverColor: null, lastCoverColor: null })
  })

  it('maps the Music Video filter to video-only content', () => {
    expect(getHomeFilterVisibility('all')).toEqual({ showMusic: true, showPodcasts: true, showVideos: true })
    expect(getHomeFilterVisibility('music')).toEqual({ showMusic: true, showPodcasts: false, showVideos: false })
    expect(getHomeFilterVisibility('podcasts')).toEqual({ showMusic: false, showPodcasts: true, showVideos: false })
    expect(getHomeFilterVisibility('videos')).toEqual({ showMusic: false, showPodcasts: false, showVideos: true })
  })

  it('renders the Music Video category chip and surfaces music video content', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const videoFilter = await screen.findByRole('button', { name: 'Music Video' })
    expect(videoFilter).toHaveClass('h-8', 'px-3', 'py-1', 'text-sm', 'font-normal', 'text-primary', 'bg-primary/10')
    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('text-primary', 'bg-primary/20')
    for (const container of [screen.getByTestId('home-filter-content'), screen.getByTestId('home-main-content')]) {
      expect(container).toHaveClass('px-4', 'sm:px-6', 'lg:px-8', '2xl:px-10')
    }
    fireEvent.click(videoFilter)

    expect(await screen.findByRole('heading', { name: 'Music videos' })).toBeInTheDocument()
    expect(screen.getByText('Back to Friends')).toBeInTheDocument()
  })

  it('makes home music video cards draggable and menu-capable', () => {
    render(
      <MemoryRouter>
        <HomeVideoTile video={video} queue={[video]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'More options for Back to Friends' })).toBeInTheDocument()
    const transfer = dataTransfer()
    fireEvent.dragStart(screen.getByText('Back to Friends').closest('.group')!, { dataTransfer: transfer })

    expect(transfer.setData).toHaveBeenCalledWith(VIDEO_DND_MIME, video.id)
    expect(useDragStore.getState().draggedVideo?.id).toBe(video.id)
  })

  it('makes home podcast cards draggable and menu-capable', () => {
    render(
      <MemoryRouter>
        <HomePodcastTile podcast={podcast} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'More options for Night Drive' })).toBeInTheDocument()
    const transfer = dataTransfer()
    fireEvent.dragStart(screen.getByText('Night Drive').closest('.group')!, { dataTransfer: transfer })

    expect(transfer.setData).toHaveBeenCalledWith(PODCAST_DND_MIME, podcast.id)
    expect(useDragStore.getState().draggedPodcast?.id).toBe(podcast.id)
  })

  it('opens the existing playlist menu from a Home quick-access tile right-click', async () => {
    render(
      <MemoryRouter>
        <HomeQuickPlaylist playlist={playlist} />
      </MemoryRouter>,
    )

    const playlistLink = screen.getByRole('link', { name: 'Home Playlist' })
    expect(playlistLink).toHaveClass('bg-primary/10', 'hover:bg-primary/20', 'backdrop-blur-sm')
    fireEvent.contextMenu(playlistLink, {
      clientX: 120,
      clientY: 80,
    })

    const menuItem = await screen.findByRole('menuitem', { name: 'Add to queue' })
    expect(menuItem).toBeInTheDocument()
    fireEvent.click(menuItem)
  })

  it('uses artwork hue only when hovering a top quick-access playlist', async () => {
    render(
      <MemoryRouter>
        <HomeQuickPlaylist playlist={playlist} />
      </MemoryRouter>,
    )

    const playlistLink = screen.getByRole('link', { name: 'Home Playlist' })
    fireEvent.mouseEnter(playlistLink)

    await waitFor(() => expect(useHueStore.getState().hoverColor).toBe('hsl(280 42% 38%)'))
    expect(dominantColorMock).toHaveBeenCalledWith('/playlist.jpg')
    expect(useHueStore.getState().lastCoverColor).toBe('hsl(280 42% 38%)')

    fireEvent.mouseLeave(playlistLink)
    expect(useHueStore.getState().hoverColor).toBeNull()
  })

  it('shows a visualizer for the active playlist and uses the larger play control', () => {
    usePlayerStore.setState({
      currentContextType: 'playlist',
      currentContextId: playlist.id,
      isPlaying: true,
    })

    render(
      <MemoryRouter>
        <HomeQuickPlaylist playlist={playlist} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Now playing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Pause ${playlist.name}` })).toHaveClass('h-12', 'w-12')
  })

  it('moves a Daily Mix to the front immediately when it is pinned', async () => {
    dailyMixesMock.mockResolvedValue(dailyMixes)
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const first = await screen.findByText('First Daily Mix')
    const second = await screen.findByText('Second Daily Mix')
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.contextMenu(second.closest('.group')!, { clientX: 140, clientY: 90 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin to top' }))

    await waitFor(() => {
      expect(second.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })
})
