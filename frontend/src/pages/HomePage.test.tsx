import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage, HomePodcastTile, HomeVideoTile, getHomeFilterVisibility } from './HomePage'
import { useDragStore } from '@/stores/dragStore'
import { PODCAST_DND_MIME, VIDEO_DND_MIME } from '@/utils/trackDnd'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

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
      getDailyMixes: vi.fn(() => Promise.resolve([])),
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

function dataTransfer() {
  return {
    effectAllowed: '',
    setData: vi.fn(),
    setDragImage: vi.fn(),
  }
}

describe('Home media interactions', () => {
  beforeEach(() => {
    useDragStore.setState({
      draggedTrack: null,
      draggedArtist: null,
      draggedAlbum: null,
      draggedVideo: null,
      draggedPodcast: null,
    })
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

    fireEvent.click(await screen.findByRole('button', { name: 'Music Video' }))

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
})
