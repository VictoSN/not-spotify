import type { Album } from '@/types/album'
import { api } from './api'

export const albumService = {
  async getById(id: string): Promise<Album> {
    const res = await api.get<Album>(`/albums/${id}`)
    return res.data
  },

  async getNewReleases(limit = 10): Promise<Album[]> {
    const res = await api.get<Album[]>('/albums')
    return [...res.data].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)).slice(0, limit)
  },

  async search(query: string): Promise<Album[]> {
    const res = await api.get<{ albums: Album[] }>('/search', { params: { q: query, type: 'album' } })
    return res.data.albums
  },

  async getSavedAlbums(): Promise<Album[]> {
    const res = await api.get<Album[]>('/me/saved-albums')
    return res.data
  },

  async saveToLibrary(albumId: string): Promise<void> {
    await api.post(`/me/saved-albums/${albumId}`)
  },

  async unsaveFromLibrary(albumId: string): Promise<void> {
    await api.delete(`/me/saved-albums/${albumId}`)
  },

  async downloadZip(albumId: string, albumTitle: string): Promise<void> {
    const res = await api.get(`/albums/${albumId}/download-zip`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${albumTitle}.zip`
    a.click()
    URL.revokeObjectURL(url)
  },
}
