import { ArrowsRightLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

export function ShuffleRepeatControls() {
  const { shuffleEnabled, repeatMode, toggleShuffle, cycleRepeat } = usePlayerStore()
  const user = useAuthStore((s) => s.user)
  const isFree = user?.capabilities?.unlimitedPlayback === false

  if (isFree) {
    return (
      <div className="flex items-center gap-4">
        <div
          className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center text-secondary/40"
          aria-label="Shuffle: not available on Free plan"
        >
          <ArrowsRightLeftIcon className="w-4 h-4" />
        </div>
        <div
          className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center text-secondary/40"
          aria-label="Repeat: not available on Free plan"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={toggleShuffle}
        className={cn(
          'relative transition-all hover:scale-110 active:scale-90',
          shuffleEnabled ? 'text-accent' : 'text-secondary hover:text-primary',
        )}
        aria-label="Toggle shuffle"
        aria-pressed={shuffleEnabled}
      >
        <ArrowsRightLeftIcon className="w-4 h-4" />
        {shuffleEnabled && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
        )}
      </button>

      <button
        onClick={cycleRepeat}
        className={cn(
          'relative transition-all hover:scale-110 active:scale-90',
          repeatMode !== 'off' ? 'text-accent' : 'text-secondary hover:text-primary',
        )}
        aria-label={`Repeat: ${repeatMode}`}
      >
        <ArrowPathIcon className="w-4 h-4" />
        {repeatMode === 'one' && (
          <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-accent leading-none">1</span>
        )}
        {repeatMode !== 'off' && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
        )}
      </button>
    </div>
  )
}
