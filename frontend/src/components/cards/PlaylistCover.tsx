import type { PlaylistTrack } from '@/types/playlist'

interface PlaylistCoverProps {
  coverUrl: string | null
  tracks?: PlaylistTrack[]
  name: string
  className?: string
}

/**
 * Playlist artwork with Spotify-style fallback:
 *   1. custom cover image, else
 *   2. a 2x2 mosaic of the first four distinct album covers, else
 *   3. a single album cover, else
 *   4. a music-note placeholder.
 */
export function PlaylistCover({ coverUrl, tracks, name, className = '' }: PlaylistCoverProps) {
  if (coverUrl) {
    return <img src={coverUrl} alt={name} className={`h-full w-full object-cover ${className}`} />
  }

  // Distinct album covers, in track order, up to four.
  const covers: string[] = []
  for (const pt of tracks ?? []) {
    const url = pt.track?.album?.coverUrl
    if (url && !covers.includes(url)) covers.push(url)
    if (covers.length === 4) break
  }

  if (covers.length >= 4) {
    return (
      <div className={`grid h-full w-full grid-cols-2 grid-rows-2 ${className}`}>
        {covers.map((url, i) => (
          <img key={i} src={url} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
    )
  }

  if (covers.length >= 1) {
    return <img src={covers[0]} alt={name} className={`h-full w-full object-cover ${className}`} />
  }

  return <div className={`flex h-full w-full items-center justify-center text-4xl ${className}`}>🎵</div>
}
