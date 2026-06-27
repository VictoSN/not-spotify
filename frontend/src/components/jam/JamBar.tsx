import { UserGroupIcon, XMarkIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import { useJamStore } from '@/stores/jamStore'
import { useState } from 'react'
import { JamInviteModal } from './JamInviteModal'

/**
 * Slim banner shown while a listen-along ("Jam") is active — hosting or
 * listening. Sits just above the bottom player bar.
 */
export function JamBar() {
  const role = useJamStore((s) => s.role)
  const hostId = useJamStore((s) => s.hostId)
  const hostName = useJamStore((s) => s.hostName)
  const participants = useJamStore((s) => s.participants)
  const stopJam = useJamStore((s) => s.stopJam)
  const [inviteOpen, setInviteOpen] = useState(false)

  if (role === 'off') return null

  return (
    <div className="flex items-center gap-3 bg-accent/15 border-t border-accent/30 px-4 py-1.5 text-sm">
      <UserGroupIcon className="h-4 w-4 shrink-0 text-accent" />
      {role === 'host' ? (
        <>
          <span className="font-semibold text-primary">Jamming</span>
          <span className="text-secondary">· {participants} listening</span>
          <button
            onClick={() => setInviteOpen(true)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
            Invite friends
          </button>
        </>
      ) : (
        <>
          <span className="font-semibold text-primary">Listening with {hostName}</span>
          <span className="text-secondary">· in sync</span>
        </>
      )}
      <button
        onClick={stopJam}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-secondary transition-colors hover:bg-primary/10 hover:text-primary ${role === 'host' ? 'ml-3' : 'ml-auto'}`}
        aria-label={role === 'host' ? 'End jam' : 'Leave jam'}
      >
        <XMarkIcon className="h-3.5 w-3.5" />
        {role === 'host' ? 'End' : 'Leave'}
      </button>
      {role === 'host' && hostId && hostName && inviteOpen && (
        <JamInviteModal hostId={hostId} hostName={hostName} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  )
}
