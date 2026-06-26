import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import type { MusicVideo } from '@/types/musicVideo'
import { api } from './api'

export interface SearchResults {
  tracks: Track[]
  artists: Artist[]
  albums: Album[]
  playlists: Playlist[]
  musicVideos?: MusicVideo[]
  /** Tracks whose lyrics (not title) matched the query. */
  tracksByLyrics: Track[]
}

export const searchService = {
  async search(query: string, _genre?: string): Promise<SearchResults> {
    const res = await api.get<SearchResults>('/search', { params: { q: query } })
    return res.data
  },
}
