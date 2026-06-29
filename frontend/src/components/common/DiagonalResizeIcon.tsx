interface DiagonalResizeIconProps {
  className?: string
}

export function DiagonalExpandIcon({ className = 'h-5 w-5' }: DiagonalResizeIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M16.6 5.6h2.2v2.2M18.8 5.6l-4.5 4.5M7.4 18.4H5.2v-2.2M5.2 18.4l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DiagonalCollapseIcon({ className = 'h-5 w-5' }: DiagonalResizeIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M18.6 5.4l-4.4 4.4M14.2 7.6v2.2h2.2M5.4 18.6l4.4-4.4M7.6 14.2h2.2v2.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
