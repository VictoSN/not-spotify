import type { Track } from './track'

/** A local SVG rather than an empty image source, so private uploads use the same
 * music-note treatment everywhere the shared player renders album art. */
const PRIVATE_UPLOAD_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%2324262a'/%3E%3Ccircle cx='128' cy='128' r='76' fill='%233a3d44'/%3E%3Cpath d='M154 65v86.5a29 29 0 1 1-12-23.4V91l-53 15v61.5a29 29 0 1 1-12-23.4V97z' fill='%23b3b7bf'/%3E%3C/svg%3E"

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
    album: { id: u.id, title: queueAlbumTitle, coverUrl: u.coverUrl || PRIVATE_UPLOAD_PLACEHOLDER, releaseDate: u.createdAt.slice(0, 10), type: 'album' },
    genres: [],
    createdAt: u.createdAt,
    isPrivateUpload: true,
  }
}
