import type { Track } from '@/types/track'
import { PlaylistCover } from '@/components/cards/PlaylistCover'

/**
 * Personal uploads use the same artwork fallback as playlists. Public catalogue
 * covers retain their normal image rendering; private uploads never show a broken
 * image when the owner has not selected artwork.
 */
export function TrackArtwork({ track, className = '', alt }: { track: Track; className?: string; alt?: string }) {
  if (track.isPrivateUpload) {
    return <PlaylistCover coverUrl={track.album.coverUrl || null} name={alt ?? track.title} className={className} />
  }
  return <img src={track.album.coverUrl} alt={alt ?? track.album.title} draggable={false} className={className} />
}
