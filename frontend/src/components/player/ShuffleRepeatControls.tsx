import { ArrowsRightLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/utils/cn'

export function ShuffleRepeatControls() {
  const { shuffleEnabled, repeatMode, toggleShuffle, cycleRepeat } = usePlayerStore()

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={toggleShuffle}
        className={cn('transition-colors relative', shuffleEnabled ? 'text-accent' : 'text-secondary hover:text-primary')}
        aria-label="Toggle shuffle"
        aria-pressed={shuffleEnabled}
      >
        <ArrowsRightLeftIcon className="w-4 h-4" />
        {shuffleEnabled && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
      </button>

      <button
        onClick={cycleRepeat}
        className={cn('transition-colors relative', repeatMode !== 'off' ? 'text-accent' : 'text-secondary hover:text-primary')}
        aria-label={`Repeat: ${repeatMode}`}
      >
        <ArrowPathIcon className="w-4 h-4" />
        {repeatMode === 'one' && (
          <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-accent leading-none">1</span>
        )}
        {repeatMode !== 'off' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
      </button>
    </div>
  )
}
