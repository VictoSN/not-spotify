import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HomePage,
  HomePodcastTile,
  HomeQuickPlaylist,
  HomeVideoTile,
  getHomeFilterVisibility,
  getHomeHueSeed,
} from './HomePage'
import { useDragStore } from '@/stores/dragStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useHueStore } from '@/stores/hueStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { PODCAST_DND_MIME, VIDEO_DND_MIME } from '@/utils/trackDnd'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import type { DailyMix } from '@/services/trackService'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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
const recommendedPlaylistsMock = vi.hoisted(() => vi.fn(() => Promise.resolve([] as Playlist[])))
const forYouMock = vi.hoisted(() => vi.fn(() => Promise.resolve([] as Track[])))
const trendingMock = vi.hoisted(() => vi.fn(() => Promise.resolve([] as Track[])))
const recentsMock = vi.hoisted(() => vi.fn(() => Promise.resolve([] as Track[])))

vi.mock('@/services/trackService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/trackService')>()
  return {
    ...actual,
    trackService: {
      getForYou: forYouMock,
      getTrending: trendingMock,
      getRecents: recentsMock,
      getMostLiked: vi.fn(() => Promise.resolve([])),
      getNewMusic: vi.fn(() => Promise.resolve([])),
      getDailyMixes: dailyMixesMock,
      getPopularInCountry: vi.fn(() => Promise.resolve([])),
    },
  }
})

vi.mock('@/services/playlistService', () => ({
  playlistService: {
    getRecommended: recommendedPlaylistsMock,
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

const homeTrack = {
  id: 'home-track',
  title: 'Home Track',
  durationMs: 180_000,
  audioUrl: '/home-track.mp3',
  artist: { id: 'home-artist', name: 'Home Artist', imageUrl: null },
  album: { id: 'home-album', title: 'Home Album', coverUrl: '/home-cover.jpg', releaseDate: '2026-01-01', type: 'album' },
  genres: [],
  playCount: 0,
  ratingCount: 0,
  averageRating: 0,
  previewUrl: null,
  trackNumber: 1,
  discNumber: 1,
  explicit: false,
  createdAt: '2026-01-01',
} as unknown as Track

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
    vi.clearAllMocks()
    dominantColorMock.mockResolvedValue('hsl(280 42% 38%)')
    window.localStorage.clear()
    dailyMixesMock.mockResolvedValue([])
    recommendedPlaylistsMock.mockResolvedValue([])
    forYouMock.mockResolvedValue([])
    trendingMock.mockResolvedValue([])
    recentsMock.mockResolvedValue([])
    useAuthStore.setState({ isAuthenticated: false, user: null })
    useLibraryStore.setState({ isLoading: false, savedPlaylists: [] })
    usePlayerStore.setState({ currentContextType: null, currentContextId: null, isPlaying: false })
    useDragStore.setState({
      draggedTrack: null,
      draggedArtist: null,
      draggedAlbum: null,
      draggedVideo: null,
      draggedPodcast: null,
    })
    useHueStore.setState({ hoverColor: null })
  })

  it('maps the Music Video filter to video-only content', () => {
    expect(getHomeFilterVisibility('all')).toEqual({ showMusic: true, showPodcasts: true, showVideos: true })
    expect(getHomeFilterVisibility('music')).toEqual({ showMusic: true, showPodcasts: false, showVideos: false })
    expect(getHomeFilterVisibility('podcasts')).toEqual({ showMusic: false, showPodcasts: true, showVideos: false })
    expect(getHomeFilterVisibility('videos')).toEqual({ showMusic: false, showPodcasts: false, showVideos: true })
  })

  it('uses only the first playlist cover as the signed-in Home hue seed', () => {
    const second = { ...playlist, id: 'playlist-2', coverUrl: '/playlist-2.jpg' }

    expect(getHomeHueSeed(true, [playlist, second])).toBe('/playlist.jpg')
    expect(getHomeHueSeed(false, [playlist, second])).toBeNull()
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
    expect(playlistLink).toHaveClass('bg-primary/10', 'hover:bg-primary/20', 'duration-150')
    expect(playlistLink).not.toHaveClass('backdrop-blur-sm')
    fireEvent.contextMenu(playlistLink, {
      clientX: 120,
      clientY: 80,
    })

    const menuItem = await screen.findByRole('menuitem', { name: 'Add to queue' })
    expect(menuItem).toBeInTheDocument()
    fireEvent.click(menuItem)
  })

  it('keeps the balanced skeleton until every Home section is ready', async () => {
    let resolveRecommended!: (playlists: Playlist[]) => void
    recommendedPlaylistsMock.mockReturnValue(new Promise((resolve) => {
      resolveRecommended = resolve
    }))

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status', { name: 'Loading Home' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Music Video' })).not.toBeInTheDocument()

    await React.act(async () => resolveRecommended([playlist]))

    expect(await screen.findByRole('button', { name: 'Music Video' })).toBeInTheDocument()
    expect(screen.getByText('Home Playlist')).toBeInTheDocument()
    expect(screen.getByTestId('home-hue')).toHaveClass(
      'transition-[background-color,opacity]',
      'duration-[450ms]',
      'opacity-0',
    )
    expect(screen.getByTestId('home-hue').style.backgroundColor).toBe('transparent')
    expect(screen.queryByTestId('home-loading-skeleton')).not.toBeInTheDocument()
  })

  it('links the three requested Home rows to their full collection pages', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'me', name: 'Listener', country: 'US' } as never })
    forYouMock.mockResolvedValue([homeTrack])
    recentsMock.mockResolvedValue([homeTrack])
    trendingMock.mockResolvedValue([homeTrack])

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'For you today' })
    expect(document.querySelector('a[href="/for-you-today"]')).toHaveTextContent('Show all')
    expect(document.querySelector('a[href="/recents"]')).toHaveTextContent('Show all')
    expect(document.querySelector('a[href="/trending"]')).toHaveTextContent('Show all')
  })

  it('uses artwork hue only when hovering a top quick-access playlist', async () => {
    useAuthStore.setState({ isAuthenticated: true })
    render(
      <MemoryRouter>
        <HomeQuickPlaylist playlist={playlist} />
      </MemoryRouter>,
    )

    const playlistLink = screen.getByRole('link', { name: 'Home Playlist' })
    fireEvent.mouseEnter(playlistLink)

    await waitFor(() => expect(useHueStore.getState().hoverColor).toBe('hsl(280 42% 38%)'))
    expect(dominantColorMock).toHaveBeenCalledWith('/playlist.jpg')
    fireEvent.mouseLeave(playlistLink)
    expect(useHueStore.getState().hoverColor).toBeNull()
  })

  it('does not calculate or apply playlist hover hue while logged out', () => {
    render(
      <MemoryRouter>
        <HomeQuickPlaylist playlist={playlist} />
      </MemoryRouter>,
    )

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Home Playlist' }))

    expect(dominantColorMock).not.toHaveBeenCalled()
    expect(useHueStore.getState().hoverColor).toBeNull()
  })

  it('ignores a playlist hue that finishes loading after hover ends', async () => {
    useAuthStore.setState({ isAuthenticated: true })
    let resolveColor!: (color: string) => void
    dominantColorMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveColor = resolve
    }))
    render(
      <MemoryRouter>
        <HomeQuickPlaylist playlist={playlist} />
      </MemoryRouter>,
    )

    const playlistLink = screen.getByRole('link', { name: 'Home Playlist' })
    fireEvent.mouseEnter(playlistLink)
    fireEvent.mouseLeave(playlistLink)
    await React.act(async () => resolveColor('hsl(280 42% 38%)'))

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
    expect(screen.getByRole('button', { name: `Pause ${playlist.name}` })).toHaveClass(
      'h-12',
      'w-12',
      'transition-transform',
      'duration-100',
    )
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

  // Bug #35: Daily Mix must be available to every tier, not premium-only.
  const freeUser = {
    id: 'free-user',
    name: 'Free Tester',
    country: 'US',
    plan: 'free',
    capabilities: { unlimitedPlayback: false, customPlaylistPictures: false },
  } as never

  it('shows Daily Mixes to a free-tier user (feature is not premium-gated)', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: freeUser })
    dailyMixesMock.mockResolvedValue(dailyMixes)

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // The "Made for you" Daily Mix row and its tiles render for the free account.
    expect(await screen.findByText('First Daily Mix')).toBeInTheDocument()
    expect(screen.getByText('Second Daily Mix')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Made for you' })).toBeInTheDocument()
  })

  it('lets a free-tier user play a Daily Mix instead of hitting an upgrade/auth wall', async () => {
    const playContext = vi.fn()
    usePlayerStore.setState({ playContext })
    const openAuthPrompt = vi.fn()
    useAuthPromptStore.setState({ open: openAuthPrompt })

    useAuthStore.setState({ isAuthenticated: true, user: freeUser })
    dailyMixesMock.mockResolvedValue([
      { id: 'mix-playable', title: 'Playable Mix', subtitle: 'Daily Mix', color: '#1db954', tracks: [homeTrack] },
    ])

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Play Playable Mix' }))

    // Playback starts for the free user; the guest auth-prompt never opens.
    expect(playContext).toHaveBeenCalledWith({ type: 'mix', id: 'mix-playable' }, [homeTrack], 0)
    expect(openAuthPrompt).not.toHaveBeenCalled()
  })
})
