import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import type { ApiResponse } from '@/types/api'
import { api, delay, USE_MOCK } from './api'
import { trackService } from './trackService'
import { artistService } from './artistService'
import { albumService } from './albumService'
import { playlistService } from './playlistService'

export interface SearchResults {
  tracks: Track[]
  artists: Artist[]
  albums: Album[]
  playlists: Playlist[]
}

export const searchService = {
  async search(query: string, _genre?: string): Promise<SearchResults> {
    if (USE_MOCK) {
      await delay(400)
      const [tracks, artists, albums, playlists] = await Promise.all([
        trackService.search(query),
        artistService.search(query),
        albumService.search(query),
        playlistService.search(query),
      ])
      return { tracks, artists, albums, playlists }
    }
    const res = await api.get<ApiResponse<SearchResults>>('/search', { params: { q: query } })
    return res.data.data
  },
}
