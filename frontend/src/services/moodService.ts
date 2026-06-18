import type { MoodTag } from '@/types/mood'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { api } from './api'

export const moodService = {
  async getAll(): Promise<MoodTag[]> {
    const res = await api.get<MoodTag[]>('/moods')
    return res.data
  },

  async getBySlug(slug: string): Promise<MoodTag> {
    const res = await api.get<MoodTag>(`/moods/${slug}`)
    return res.data
  },

  async getTracksByMood(slug: string): Promise<Track[]> {
    const res = await api.get<Track[]>(`/moods/${slug}/tracks`)
    return res.data
  },

  async getPlaylistsByMood(slug: string): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>(`/moods/${slug}/playlists`)
    return res.data
  },
}
