interface CollapseIconProps {
  className?: string
}

/**
 * Spotify-style "collapse panel" glyph — a panel outline with a divider and a
 * right-pointing arrow. Shared by every collapsible side panel (Now Playing,
 * library sidebar, social panel) so the collapse control reads consistently.
 */
export function CollapseIcon({ className = 'h-5 w-5' }: CollapseIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M5.75 4.75h12.5v14.5H5.75z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 7.55v8.9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="m11.05 8.65 4.35 3.35-4.35 3.35z"
        fill="currentColor"
      />
    </svg>
  )
}
