/**
 * "Connect to a device" glyph — a desktop monitor with a phone in front, the
 * standard device-switcher symbol (à la Spotify Connect). Clearer than a plain
 * speaker for "send playback to another device". Filled, uses currentColor so it
 * inherits the button's text colour. viewBox is 16-based to match the source art.
 */
export function DevicesIcon({ className }: { className?: string }) {
  return (
    <svg role="img" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M6 2.75C6 1.784 6.784 1 7.75 1h6.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15h-6.5A1.75 1.75 0 0 1 6 13.25V2.75zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25h-6.5z" />
      <path d="M3.75 3H5v1.5H3.75a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25H5V15H3.75A1.75 1.75 0 0 1 2 13.25v-8.5C2 3.784 2.784 3 3.75 3zM10 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </svg>
  )
}
