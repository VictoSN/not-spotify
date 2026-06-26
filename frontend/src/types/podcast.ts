import type { Track } from './track'

export interface Episode {
  id: string
  podcastId: string
  podcastTitle: string
  title: string
  description: string | null
  audioUrl: string
  durationMs: number
  episodeNumber: number
  imageUrl: string | null
  publishedAt: string
  explicit?: boolean
}

export interface PodcastSummary {
  id: string
  title: string
  author: string
  description: string | null
  category: string | null
  imageUrl: string | null
  episodeCount: number
  createdAt: string
}

export interface Podcast {
  id: string
  title: string
  author: string
  description: string | null
  category: string | null
  imageUrl: string | null
  createdAt: string
  episodes: Episode[]
}

/**
 * Adapt an episode to the {@link Track} shape so it plays through the existing
 * two-deck audio engine and player bar with zero player changes. The podcast
 * stands in for the album, its author for the artist.
 */
export function episodeToTrack(ep: Episode, podcast?: { title: string; author: string; imageUrl: string | null }): Track {
  const cover = ep.imageUrl ?? podcast?.imageUrl ?? ''
  const showTitle = podcast?.title ?? ep.podcastTitle
  const author = podcast?.author ?? ep.podcastTitle
  return {
    id: ep.id,
    title: ep.title,
    durationMs: ep.durationMs,
    audioUrl: ep.audioUrl,
    previewUrl: null,
    podcastId: ep.podcastId,
    trackNumber: ep.episodeNumber,
    discNumber: 1,
    explicit: ep.explicit ?? false,
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    artist: { id: ep.podcastId, name: author, imageUrl: cover || null },
    album: {
      id: ep.podcastId,
      title: showTitle,
      coverUrl: cover,
      releaseDate: ep.publishedAt.slice(0, 10),
      type: 'album',
    },
    genres: [],
    createdAt: ep.publishedAt,
  }
}
