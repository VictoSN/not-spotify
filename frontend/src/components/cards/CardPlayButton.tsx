import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'

interface CardPlayButtonProps {
  isPlaying: boolean
  isActive: boolean
  onClick: (e: React.MouseEvent) => void
  ariaLabel: string
  disabled?: boolean
  variant?: 'default' | 'artist'
}

export function CardPlayButton({
  isPlaying,
  isActive,
  onClick,
  ariaLabel,
  disabled,
  variant = 'default',
}: CardPlayButtonProps) {
  const isArtist = variant === 'artist'
  const sizeClasses = isArtist ? 'h-11 w-11 bottom-1 right-1 z-10' : 'w-10 h-10 bottom-2 right-2 z-20'
  const iconColor = isArtist ? 'text-black' : 'text-white'
  return (
    <button
      onClick={onClick}
      className={`absolute ${sizeClasses} bg-accent rounded-full flex items-center justify-center translate-y-0 transition-all duration-200 shadow-lg hover:scale-105 disabled:opacity-60 ${
        isActive
          ? 'opacity-100'
          : 'opacity-100 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0'
      }`}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {isPlaying ? (
        <PauseIcon className={`w-5 h-5 ${iconColor}`} />
      ) : (
        <PlayIcon className={`w-5 h-5 ${iconColor} ml-0.5`} />
      )}
    </button>
  )
}
