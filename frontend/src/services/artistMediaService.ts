import type { AxiosProgressEvent } from 'axios'
import type { MusicVideo } from '@/types/musicVideo'
import type { Podcast, Episode } from '@/types/podcast'
import { api } from './api'

export interface ArtistPodcastPayload {
  title: string
  description?: string | null
  category?: string | null
}

export interface ArtistEpisodeUploadPayload {
  title: string
  description?: string | null
  durationMs: number
  episodeNumber: number
  explicit: boolean
  publishedAt?: string | null
  file: File
  image?: File | null
}

export interface ArtistEpisodeUpdatePayload {
  title?: string | null
  description?: string | null
  durationMs?: number | null
  episodeNumber?: number | null
  explicit?: boolean | null
  publishedAt?: string | null
}

export interface ArtistVideoUploadPayload {
  title: string
  description?: string | null
  durationMs: number
  trackId?: string | null
  video: File
  thumbnail?: File | null
}

export interface ArtistVideoUpdatePayload {
  title?: string | null
  description?: string | null
  trackId?: string | null
  clearTrack?: boolean
}

type ProgressHandler = (percent: number) => void

function progress(handler?: ProgressHandler) {
  if (!handler) return undefined
  return (event: AxiosProgressEvent) => {
    if (!event.total) return
    handler(Math.round((event.loaded / event.total) * 100))
  }
}

function appendIfValue(fd: FormData, key: string, value: string | number | boolean | File | null | undefined) {
  if (value === undefined || value === null || value === '') return
  fd.append(key, value instanceof File ? value : String(value))
}

export async function readVideoDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null)
      video.onerror = () => resolve(null)
      video.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const artistMediaService = {
  async listPodcasts(): Promise<Podcast[]> {
    const res = await api.get<Podcast[]>('/me/artist-podcasts')
    return res.data
  },

  async createPodcast(payload: ArtistPodcastPayload): Promise<Podcast> {
    const res = await api.post<Podcast>('/me/artist-podcasts', payload)
    return res.data
  },

  async updatePodcast(id: string, payload: ArtistPodcastPayload): Promise<Podcast> {
    const res = await api.patch<Podcast>(`/me/artist-podcasts/${id}`, payload)
    return res.data
  },

  async deletePodcast(id: string): Promise<void> {
    await api.delete(`/me/artist-podcasts/${id}`)
  },

  async resubmitPodcast(id: string, note?: string): Promise<Podcast> {
    const res = await api.post<Podcast>(`/me/artist-podcasts/${id}/resubmit`, { note: note || null })
    return res.data
  },

  async uploadEpisode(podcastId: string, payload: ArtistEpisodeUploadPayload, onProgress?: ProgressHandler): Promise<Episode> {
    const fd = new FormData()
    appendIfValue(fd, 'title', payload.title)
    appendIfValue(fd, 'description', payload.description)
    appendIfValue(fd, 'durationMs', payload.durationMs)
    appendIfValue(fd, 'episodeNumber', payload.episodeNumber)
    appendIfValue(fd, 'explicit', payload.explicit)
    appendIfValue(fd, 'publishedAt', payload.publishedAt)
    appendIfValue(fd, 'file', payload.file)
    appendIfValue(fd, 'image', payload.image)

    const res = await api.post<Episode>(`/me/artist-podcasts/${podcastId}/episodes`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: progress(onProgress),
    })
    return res.data
  },

  async updateEpisode(id: string, payload: ArtistEpisodeUpdatePayload): Promise<Episode> {
    const res = await api.patch<Episode>(`/me/artist-episodes/${id}`, payload)
    return res.data
  },

  async deleteEpisode(id: string): Promise<void> {
    await api.delete(`/me/artist-episodes/${id}`)
  },

  async resubmitEpisode(id: string, note?: string): Promise<Episode> {
    const res = await api.post<Episode>(`/me/artist-episodes/${id}/resubmit`, { note: note || null })
    return res.data
  },

  async listVideos(): Promise<MusicVideo[]> {
    const res = await api.get<MusicVideo[]>('/me/artist-videos')
    return res.data
  },

  async uploadVideo(payload: ArtistVideoUploadPayload, onProgress?: ProgressHandler): Promise<MusicVideo> {
    const fd = new FormData()
    appendIfValue(fd, 'title', payload.title)
    appendIfValue(fd, 'description', payload.description)
    appendIfValue(fd, 'durationMs', payload.durationMs)
    appendIfValue(fd, 'trackId', payload.trackId)
    appendIfValue(fd, 'video', payload.video)
    appendIfValue(fd, 'thumbnail', payload.thumbnail)

    const res = await api.post<MusicVideo>('/me/artist-videos', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: progress(onProgress),
    })
    return res.data
  },

  async updateVideo(id: string, payload: ArtistVideoUpdatePayload): Promise<MusicVideo> {
    const res = await api.patch<MusicVideo>(`/me/artist-videos/${id}`, payload)
    return res.data
  },

  async deleteVideo(id: string): Promise<void> {
    await api.delete(`/me/artist-videos/${id}`)
  },

  async resubmitVideo(id: string, note?: string): Promise<MusicVideo> {
    const res = await api.post<MusicVideo>(`/me/artist-videos/${id}/resubmit`, { note: note || null })
    return res.data
  },
}
