import type { Track } from './track'

export interface UserUpload {
  id: string
  title: string
  artist: string | null
  audioUrl: string
  coverUrl: string | null
  durationMs: number
  createdAt: string
}

/** Adapt a personal upload to the {@link Track} shape so it plays unchanged. */
export function uploadToTrack(u: UserUpload, queueAlbumTitle = 'Your uploads'): Track {
  return {
    id: u.id,
    title: u.title,
    durationMs: u.durationMs,
    audioUrl: u.audioUrl,
    previewUrl: null,
    trackNumber: 1,
    discNumber: 1,
    explicit: false,
    playCount: 0,
    ratingCount: 0,
    averageRating: 0,
    artist: { id: u.id, name: u.artist ?? 'You', imageUrl: null },
    album: { id: u.id, title: queueAlbumTitle, coverUrl: u.coverUrl ?? '', releaseDate: u.createdAt.slice(0, 10), type: 'album' },
    genres: [],
    createdAt: u.createdAt,
  }
}
