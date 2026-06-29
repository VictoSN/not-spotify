import type { Genre } from '@/types/genre'
import type { Artist } from '@/types/artist'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { api } from './api'

export const genreService = {
  async getAll(): Promise<Genre[]> {
    const res = await api.get<Genre[]>('/genres')
    return res.data
  },

  async getBySlug(slug: string): Promise<Genre> {
    const res = await api.get<Genre>(`/genres/${slug}`)
    return res.data
  },

  async getTracksByGenre(slug: string): Promise<Track[]> {
    const res = await api.get<Track[]>(`/genres/${slug}/tracks`)
    return res.data
  },

  async getPlaylistsByGenre(slug: string): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>(`/genres/${slug}/playlists`)
    return res.data
  },

  async getArtistsByGenre(slug: string): Promise<Artist[]> {
    const res = await api.get<Artist[]>(`/genres/${slug}/artists`)
    return res.data
  },
}
