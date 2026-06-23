import { UserGroupIcon } from '@heroicons/react/24/outline'
import { useJamStore } from '@/stores/jamStore'
import { cn } from '@/utils/cn'

interface Props {
  hostId: string
  hostName: string
  mine: boolean
  time: string
  ticks?: React.ReactNode
}

export function SharedJamBubble({ hostId, hostName, mine, time, ticks }: Props) {
  const role = useJamStore((s) => s.role)
  const joinAs = useJamStore((s) => s.joinAs)

  return (
    <div className={cn(
      'w-64 overflow-hidden rounded-2xl border px-3.5 py-3',
      mine ? 'rounded-br-md border-white/20 bg-accent text-white' : 'rounded-bl-md border-secondary/15 bg-elevated text-primary',
    )}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', mine ? 'bg-white/15' : 'bg-accent/15 text-accent')}>
          <UserGroupIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Join my Jam</p>
          <p className={cn('truncate text-xs', mine ? 'text-white/75' : 'text-secondary')}>
            Listen together with {hostName}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => joinAs(hostId, hostName)}
        disabled={role !== 'off'}
        className={cn(
          'mt-3 w-full rounded-full px-3 py-1.5 text-xs font-bold transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-60',
          mine ? 'bg-white text-accent' : 'bg-primary text-page',
        )}
      >
        {role === 'off' ? 'Join Jam' : 'Already in a Jam'}
      </button>
      <span className={cn('mt-1.5 flex justify-end text-[10px]', mine ? 'text-white/70' : 'text-secondary')}>
        {time}{ticks}
      </span>
    </div>
  )
}
