/**
 * Smart-playlist glyph: a 4-point sparkle over crossing shuffle arrows — the same visual
 * language as Spotify's "smart shuffle". Outline style (currentColor, rounded strokes) so
 * it sits naturally beside the Heroicons used elsewhere in menus.
 *
 * The sparkle carries the `smart-sparkle` class; inside a `.group` (e.g. a menu item) it
 * gently twinkles on hover. The animation is defined in index.css and disabled under
 * prefers-reduced-motion.
 */
export function SmartShuffleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* lower arrow rising to the top-right */}
      <path d="M3 17 H6.2 C9 17 11 8.5 13.8 8.5 H19" />
      <path d="M17 6.6 L19 8.5 L17 10.4" />
      {/* upper arrow falling to the bottom-right */}
      <path d="M9.5 8.5 H6.2 C9 8.5 11 17 13.8 17 H19" />
      <path d="M17 15.1 L19 17 L17 18.9" />
      {/* sparkle */}
      <path
        className="smart-sparkle"
        d="M5 3.2 C5.15 5.1 6.1 6.05 8 6.2 C6.1 6.35 5.15 7.3 5 9.2 C4.85 7.3 3.9 6.35 2 6.2 C3.9 6.05 4.85 5.1 5 3.2 Z"
      />
    </svg>
  )
}
