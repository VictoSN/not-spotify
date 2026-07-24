import type { Track } from '@/types/track'
import { PlaylistCover } from '@/components/cards/PlaylistCover'

/**
 * Personal uploads use the same artwork fallback as playlists. Public catalogue
 * covers retain their normal image rendering; private uploads never show a broken
 * image when the owner has not selected artwork.
 */
export function TrackArtwork({ track, className = '', alt }: { track: Track; className?: string; alt?: string }) {
  if (track.isPrivateUpload) {
    // PlaylistCover's fallback intentionally fills its parent. Keep it inside this
    // wrapper so compact surfaces such as the collapsed right rail stay a square
    // instead of allowing the fallback to inherit the rail's full height.
    return (
      <div className={className}>
        <PlaylistCover coverUrl={track.album.coverUrl || null} name={alt ?? track.title} className="h-full w-full object-cover" />
      </div>
    )
  }
  return <img src={track.album.coverUrl} alt={alt ?? track.album.title} draggable={false} className={className} />
}
