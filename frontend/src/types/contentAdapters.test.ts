import { describe, it, expect } from 'vitest'
import { episodeToTrack, type Episode } from './podcast'
import { uploadToTrack, type UserUpload } from './upload'

const episode: Episode = {
  id: 'ep-1',
  podcastId: 'show-1',
  podcastTitle: 'Fallback Show',
  title: 'Episode One',
  description: 'desc',
  audioUrl: 'https://cdn/ep1.mp3',
  durationMs: 60000,
  episodeNumber: 3,
  imageUrl: 'https://cdn/ep1.png',
  publishedAt: '2026-06-21T10:00:00.000Z',
}

describe('episodeToTrack', () => {
  it('maps an episode onto the Track shape so it plays unchanged', () => {
    const t = episodeToTrack(episode)
    expect(t.id).toBe('ep-1')
    expect(t.title).toBe('Episode One')
    expect(t.audioUrl).toBe('https://cdn/ep1.mp3')
    expect(t.durationMs).toBe(60000)
    expect(t.trackNumber).toBe(3) // episode number stands in for track number
    expect(t.explicit).toBe(false)
    expect(t.previewUrl).toBeNull()
    expect(t.createdAt).toBe('2026-06-21T10:00:00.000Z')
    expect(t.album.releaseDate).toBe('2026-06-21') // date-only slice
  })

  it('prefers the passed podcast for show title / author, but the episode art for the cover', () => {
    const t = episodeToTrack(episode, { title: 'Real Show', author: 'Real Host', imageUrl: 'https://cdn/show.png' })
    expect(t.album.title).toBe('Real Show')
    expect(t.artist.name).toBe('Real Host')
    expect(t.album.coverUrl).toBe('https://cdn/ep1.png') // episode art wins over the show art
  })

  it('falls back to the podcast cover when the episode has no art', () => {
    const noImage: Episode = { ...episode, imageUrl: null }
    const t = episodeToTrack(noImage, { title: 'Real Show', author: 'Real Host', imageUrl: 'https://cdn/show.png' })
    expect(t.album.coverUrl).toBe('https://cdn/show.png')
  })

  it('falls back to the episode fields when no podcast is given', () => {
    const noImage: Episode = { ...episode, imageUrl: null }
    const t = episodeToTrack(noImage)
    expect(t.album.title).toBe('Fallback Show')
    expect(t.artist.name).toBe('Fallback Show')
    expect(t.album.coverUrl).toBe('') // no cover anywhere
    expect(t.artist.imageUrl).toBeNull()
  })

  it('preserves the explicit flag for the player metadata', () => {
    const t = episodeToTrack({ ...episode, explicit: true })
    expect(t.explicit).toBe(true)
  })
})

describe('uploadToTrack', () => {
  const upload: UserUpload = {
    id: 'up-1',
    title: 'My Demo',
    artist: 'DJ Me',
    audioUrl: 'https://cdn/up1.mp3',
    durationMs: 12345,
    createdAt: '2026-01-02T00:00:00.000Z',
  }

  it('maps a personal upload onto the Track shape', () => {
    const t = uploadToTrack(upload)
    expect(t.id).toBe('up-1')
    expect(t.title).toBe('My Demo')
    expect(t.artist.name).toBe('DJ Me')
    expect(t.audioUrl).toBe('https://cdn/up1.mp3')
    expect(t.album.title).toBe('Your uploads') // default queue album
    expect(t.album.releaseDate).toBe('2026-01-02')
  })

  it('uses "You" when the upload has no artist, and honors a custom queue album', () => {
    const t = uploadToTrack({ ...upload, artist: null }, 'Liked uploads')
    expect(t.artist.name).toBe('You')
    expect(t.album.title).toBe('Liked uploads')
  })
})
