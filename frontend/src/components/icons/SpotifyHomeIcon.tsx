interface SpotifyHomeIconProps {
  className?: string
}

export function SpotifyHomeIcon({ className }: SpotifyHomeIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845a2 2 0 0 0-1 1.732V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732zm-2 1.732a1 1 0 0 1 1 0l7.5 4.33V20h-4v-5a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v5H4V7.577z" />
    </svg>
  )
}

export function SpotifyHomeSolidIcon({ className }: SpotifyHomeIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845a2 2 0 0 0-1 1.732V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732z" />
    </svg>
  )
}
