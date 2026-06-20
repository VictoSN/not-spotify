import type { Track, TrackComment } from '@/types/track'
import { api } from './api'

function downloadFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback

  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return fallback
    }
  }

  return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function downloadError(error: unknown): Promise<Error> {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string }
      if (parsed.message) return new Error(parsed.message)
    } catch {
      // The server may have returned a non-JSON error body.
    }
  }
  return error instanceof Error ? error : new Error('Could not download this track.')
}

export interface ChartEntry {
  rank: number
  playsThisWeek: number
  track: Track
}

export interface DailyMix {
  id: string
  title: string
  subtitle: string
  color: string | null
  tracks: Track[]
}

export const trackService = {
  async getById(id: string): Promise<Track> {
    const res = await api.get<Track>(`/tracks/${id}`)
    return res.data
  },

  async download(trackId: string, trackTitle: string): Promise<void> {
    try {
      const res = await api.get<Blob>(`/tracks/${trackId}/download`, {
        responseType: 'blob',
      })
      const filename = downloadFilename(
        res.headers['content-disposition'],
        `${trackTitle}.mp3`,
      )
      saveBlob(res.data, filename)
    } catch (error) {
      throw await downloadError(error)
    }
  },

  async getTrending(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/trending', { params: { limit } })
    return res.data
  },

  async getCharts(limit = 50): Promise<ChartEntry[]> {
    const res = await api.get<ChartEntry[]>('/tracks/charts', { params: { limit } })
    return res.data
  },

  async getRadio(trackId: string, limit = 30): Promise<Track[]> {
    const res = await api.get<Track[]>(`/tracks/${trackId}/radio`, { params: { limit } })
    return res.data
  },

  async getDailyMixes(count = 4): Promise<DailyMix[]> {
    const res = await api.get<DailyMix[]>('/tracks/daily-mixes', { params: { count } })
    return res.data
  },

  async getMostLiked(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/most-liked', { params: { limit } })
    return res.data
  },

  async getNewMusic(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/new-music', { params: { limit } })
    return res.data
  },

  async getPopularInCountry(country?: string, limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/popular', { params: { country, limit } })
    return res.data
  },

  async getForYou(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/for-you', { params: { limit } })
    return res.data
  },

  async getDiscoverWeekly(limit = 50): Promise<Track[]> {
    const res = await api.get<Track[]>('/tracks/discover-weekly', { params: { limit } })
    return res.data
  },

  async getByAlbum(albumId: string): Promise<Track[]> {
    const res = await api.get<Track[]>(`/albums/${albumId}/tracks`)
    return res.data
  },

  async search(query: string): Promise<Track[]> {
    const res = await api.get<{ tracks: Track[] }>('/search', { params: { q: query, type: 'track' } })
    return res.data.tracks
  },

  async getRecents(limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>('/me/recents', { params: { limit } })
    return res.data
  },

  async recordPlay(trackId: string): Promise<void> {
    await api.post('/me/plays', { trackId })
  },

  async like(trackId: string): Promise<void> {
    await api.post(`/me/saved-tracks/${trackId}`)
  },

  async unlike(trackId: string): Promise<void> {
    await api.delete(`/me/saved-tracks/${trackId}`)
  },

  async getLikedSongs(): Promise<{ track: Track; savedAt: string }[]> {
    const res = await api.get<{ track: Track; savedAt: string }[]>('/me/saved-tracks')
    return res.data
  },

  async getMyRatings(): Promise<Record<string, number>> {
    const res = await api.get<Record<string, number>>('/me/ratings')
    return res.data
  },

  async rateTrack(trackId: string, rating: number): Promise<{ ratingCount: number; averageRating: number; myRating: number }> {
    const res = await api.put(`/me/track-ratings/${trackId}`, { rating })
    return res.data
  },

  async unrateTrack(trackId: string): Promise<{ ratingCount: number; averageRating: number; myRating: number }> {
    const res = await api.delete(`/me/track-ratings/${trackId}`)
    return res.data
  },

  async getLyrics(id: string): Promise<{ lyrics: string | null; syncedLyrics: string | null; source: string }> {
    const res = await api.get<{ lyrics: string | null; syncedLyrics: string | null; source: string }>(`/tracks/${id}/lyrics`)
    return res.data
  },

  async getComments(trackId: string, limit = 50): Promise<TrackComment[]> {
    const res = await api.get<TrackComment[]>(`/tracks/${trackId}/comments`, { params: { limit } })
    return res.data
  },

  async getCommentReplies(trackId: string, commentId: string): Promise<TrackComment[]> {
    const res = await api.get<TrackComment[]>(`/tracks/${trackId}/comments/${commentId}/replies`)
    return res.data
  },

  async postComment(trackId: string, body: string, parentId?: string, timestampMs?: number): Promise<TrackComment> {
    const res = await api.post<TrackComment>(`/tracks/${trackId}/comments`, {
      body,
      parentId: parentId ?? null,
      timestampMs: timestampMs ?? null,
    })
    return res.data
  },

  async deleteComment(trackId: string, commentId: string): Promise<void> {
    await api.delete(`/tracks/${trackId}/comments/${commentId}`)
  },
}
