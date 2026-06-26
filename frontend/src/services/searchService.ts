import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Playlist } from '@/types/playlist'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import type { UserSearchResult } from '@/types/friend'
import { api } from './api'
import { podcastService } from './podcastService'
import { friendService } from './friendService'

export interface SearchResults {
  tracks: Track[]
  artists: Artist[]
  albums: Album[]
  playlists: Playlist[]
  musicVideos?: MusicVideo[]
  podcasts?: PodcastSummary[]
  profiles?: UserSearchResult[]
  /** Tracks whose lyrics (not title) matched the query. */
  tracksByLyrics: Track[]
}

export const searchService = {
  async search(query: string, _genre?: string): Promise<SearchResults> {
    const q = query.trim()
    const [res, podcasts, profiles] = await Promise.all([
      api.get<SearchResults>('/search', { params: { q } }),
      podcastService.getAll()
        .then((rows) => filterPodcasts(rows, q))
        .catch(() => [] as PodcastSummary[]),
      q.length >= 2
        ? friendService.searchUsers(q).catch(() => [] as UserSearchResult[])
        : Promise.resolve([] as UserSearchResult[]),
    ])

    return {
      ...res.data,
      musicVideos: res.data.musicVideos ?? [],
      podcasts,
      profiles,
      tracksByLyrics: res.data.tracksByLyrics ?? [],
    }
  },
}

function filterPodcasts(rows: PodcastSummary[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return rows
    .filter((podcast) =>
      [podcast.title, podcast.author, podcast.category, podcast.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    )
    .slice(0, 20)
}
