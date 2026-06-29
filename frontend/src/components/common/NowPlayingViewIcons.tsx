interface NowPlayingViewIconProps {
  className?: string
}

/** Solid record glyph used by Spotify's "Show artwork" view control. */
export function ArtworkViewIcon({ className = 'h-5 w-5' }: NowPlayingViewIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm0 7.8a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/** Solid artist silhouette with music note used by Spotify's artist-image view. */
export function ArtistViewIcon({ className = 'h-5 w-5' }: NowPlayingViewIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="8.8" cy="5.6" r="4.6" />
      <path d="M8.8 10.2C3.9 10.2 0 14.1 0 19v1.6h12.7a6.8 6.8 0 0 1-1.1-3.7c0-2.2 1-4.3 2.7-5.7a8.8 8.8 0 0 0-5.5-1Z" />
      <path d="M21.7 5.6v9.1a4.1 4.1 0 1 0 2.3 3.7V5.6h-2.3Z" />
    </svg>
  )
}
