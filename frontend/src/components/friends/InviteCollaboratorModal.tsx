import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon, UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { useFriendStore } from '@/stores/friendStore'
import { collaboratorService } from '@/services/collaboratorService'
import type { UserRef } from '@/types/user'
import { notify } from '@/utils/toast'

interface InviteCollaboratorModalProps {
  playlistId: string
  existingCollaborators: UserRef[]
  onInvited: (user: UserRef) => void
  onClose: () => void
}

export function InviteCollaboratorModal({
  playlistId,
  existingCollaborators,
  onInvited,
  onClose,
}: InviteCollaboratorModalProps) {
  const friends = useFriendStore((s) => s.friends)
  const [query, setQuery] = useState('')
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(
    new Set(existingCollaborators.map((c) => c.id)),
  )

  const filtered = friends.filter((f) =>
    query.trim() === '' || f.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const handleInvite = async (friend: { userId: string; name: string; avatarUrl: string | null }) => {
    setInvitingId(friend.userId)
    try {
      await collaboratorService.invite(playlistId, friend.userId)
      const userRef: UserRef = { id: friend.userId, name: friend.name, avatarUrl: friend.avatarUrl }
      setInvitedIds((s) => new Set([...s, friend.userId]))
      onInvited(userRef)
    } catch {
      notify.error("Couldn't invite collaborator")
    } finally {
      setInvitingId(null)
    }
  }

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center px-4">
        <DialogPanel className="relative w-full max-w-md rounded-lg bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-secondary transition-colors hover:bg-elevated hover:text-primary"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <DialogTitle className="mb-5 text-xl font-bold text-primary">Invite collaborator</DialogTitle>

        {/* Search friends */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends…"
          className="w-full h-9 rounded-md bg-elevated text-sm text-primary placeholder:text-muted px-3 mb-4 outline-none focus:ring-1 focus:ring-accent/50"
          autoFocus
        />

        <div className="max-h-72 overflow-y-auto space-y-1">
          {friends.length === 0 && (
            <p className="text-sm text-secondary text-center py-4">
              Add some friends first to invite them as collaborators.
            </p>
          )}
          {filtered.length === 0 && friends.length > 0 && (
            <p className="text-sm text-secondary text-center py-4">No matches.</p>
          )}
          {filtered.map((f) => {
            const alreadyAdded = invitedIds.has(f.userId)
            const isBusy = invitingId === f.userId
            return (
              <div
                key={f.userId}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-elevated transition-colors"
              >
                <Avatar src={f.avatarUrl} alt={f.name} size="sm" round />
                <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{f.name}</p>
                {alreadyAdded ? (
                  <span className="flex items-center gap-1 text-xs text-secondary shrink-0">
                    <CheckIcon className="w-4 h-4 text-accent" />
                    Added
                  </span>
                ) : (
                  <button
                    onClick={() => void handleInvite(f)}
                    disabled={isBusy}
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                    {isBusy ? 'Inviting…' : 'Invite'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
