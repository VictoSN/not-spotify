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
      mine
        ? 'chat-bubble-outgoing chat-bubble-border rounded-br-md'
        : 'chat-bubble-incoming chat-bubble-border rounded-bl-md',
    )}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', mine ? 'bg-black/10' : 'bg-accent/15 text-accent')}>
          <UserGroupIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Join my Jam</p>
          <p className={cn('truncate text-xs', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
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
          mine ? 'bg-white/90 text-[#144d37]' : 'bg-primary text-page',
        )}
      >
        {role === 'off' ? 'Join Jam' : 'Already in a Jam'}
      </button>
      <span className={cn('mt-1.5 flex justify-end text-[10px]', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
        {time}{ticks}
      </span>
    </div>
  )
}
