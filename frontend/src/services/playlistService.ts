import type { Playlist, PlaylistVisibility, SmartPlaylistRules } from '@/types/playlist'
import type { Track } from '@/types/track'
import { api } from './api'

export const playlistService = {
  async getById(id: string): Promise<Playlist> {
    const res = await api.get<Playlist>(`/playlists/${id}`)
    return res.data
  },

  async getRecommended(limit = 10): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/playlists')
    return res.data.slice(0, limit)
  },

  async getFeatured(limit = 6): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/playlists/featured', { params: { limit } })
    return res.data
  },

  async getUserPlaylists(): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/me/playlists')
    return res.data
  },

  async create(
    name: string,
    description?: string,
    isPublic = true,
    smartRules?: SmartPlaylistRules,
    coverUrl?: string | null,
  ): Promise<Playlist> {
    const res = await api.post<Playlist>('/playlists', { name, description, isPublic, smartRules, coverUrl })
    return res.data
  },

  /** Three-state visibility setter. Use this for all new code. */
  async setVisibility(playlistId: string, visibility: PlaylistVisibility): Promise<Playlist> {
    const res = await api.patch<Playlist>(`/playlists/${playlistId}`, { visibility })
    return res.data
  },

  /** @deprecated Use setVisibility instead. */
  async updateVisibility(playlistId: string, isPublic: boolean): Promise<Playlist> {
    return this.setVisibility(playlistId, isPublic ? 'public' : 'private')
  },

  async update(
    playlistId: string,
    payload: {
      name?: string
      description?: string | null
      isPublic?: boolean
      visibility?: PlaylistVisibility
      smartRules?: SmartPlaylistRules
      clearSmartRules?: boolean
    },
  ): Promise<Playlist> {
    const res = await api.patch<Playlist>(`/playlists/${playlistId}`, payload)
    return res.data
  },

  async uploadCover(playlistId: string, file: File): Promise<Playlist> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Playlist>(`/playlists/${playlistId}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async addTrack(playlistId: string, track: Track): Promise<Playlist> {
    const res = await api.post<Playlist>(`/playlists/${playlistId}/tracks`, { trackId: track.id })
    return res.data
  },

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`)
  },

  async delete(playlistId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}`)
  },

  async save(playlistId: string): Promise<void> {
    await api.post(`/me/saved-playlists/${playlistId}`)
  },

  async unsave(playlistId: string): Promise<void> {
    await api.delete(`/me/saved-playlists/${playlistId}`)
  },

  async search(query: string): Promise<Playlist[]> {
    const res = await api.get<{ playlists: Playlist[] }>('/search', { params: { q: query, type: 'playlist' } })
    return res.data.playlists
  },

  async getRecommendations(playlistId: string, limit = 10): Promise<Track[]> {
    const res = await api.get<Track[]>(`/playlists/${playlistId}/recommendations`, { params: { limit } })
    return res.data
  },

  async downloadZip(playlistId: string, playlistName: string): Promise<void> {
    const res = await api.get(`/playlists/${playlistId}/download-zip`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${playlistName}.zip`
    a.click()
    URL.revokeObjectURL(url)
  },

  // ── Admin ──
  async adminList(search?: string): Promise<Playlist[]> {
    const res = await api.get<Playlist[]>('/admin/playlists', { params: search ? { search } : {} })
    return res.data
  },

  async setFeatured(playlistId: string, isFeatured?: boolean, sortOrder?: number): Promise<Playlist> {
    const res = await api.patch<Playlist>(`/admin/playlists/${playlistId}/feature`, { isFeatured, sortOrder })
    return res.data
  },
}
