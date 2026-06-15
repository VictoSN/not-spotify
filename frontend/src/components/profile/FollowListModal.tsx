import { useEffect, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Link } from 'react-router-dom'
import { CheckBadgeIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { friendService } from '@/services/friendService'
import { useAuthStore } from '@/stores/authStore'
import { notify } from '@/utils/toast'
import type { FollowUser } from '@/types/friend'

type Mode = 'followers' | 'following'

/** Lists a user's followers or the accounts they follow, with inline follow toggles. */
export function FollowListModal({
  open,
  onClose,
  userId,
  mode,
}: {
  open: boolean
  onClose: () => void
  userId: string
  mode: Mode
}) {
  const me = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const load = mode === 'followers' ? friendService.getFollowers : friendService.getFollowing
    load(userId)
      .then(setUsers)
      .catch(() => notify.error('Could not load that list.'))
      .finally(() => setLoading(false))
  }, [open, userId, mode])

  const toggleFollow = async (target: FollowUser) => {
    setBusyId(target.id)
    const next = !target.isFollowedByMe
    // Optimistic — revert on failure.
    setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, isFollowedByMe: next } : u)))
    try {
      if (next) await friendService.follow(target.id)
      else await friendService.unfollow(target.id)
    } catch {
      setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, isFollowedByMe: !next } : u)))
      notify.error(next ? 'Could not follow.' : 'Could not unfollow.')
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center px-4">
        <DialogPanel className="relative flex max-h-[70vh] w-full max-w-md flex-col rounded-lg bg-surface p-6 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-secondary transition-colors hover:bg-elevated hover:text-primary"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <DialogTitle className="mb-4 text-xl font-bold capitalize text-primary">{mode}</DialogTitle>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary">
              {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            <ul className="-mx-2 overflow-y-auto">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-elevated">
                  <Link to={`/user/${u.id}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={u.avatarUrl} alt={u.name} size="md" round />
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate text-sm font-semibold text-primary">{u.name}</span>
                      {u.isArtist && <CheckBadgeIcon className="h-4 w-4 shrink-0 text-accent" title="Artist" />}
                    </span>
                  </Link>
                  {me && me.id !== u.id && (
                    <button
                      onClick={() => void toggleFollow(u)}
                      disabled={busyId === u.id}
                      className={
                        u.isFollowedByMe
                          ? 'shrink-0 rounded-full border border-secondary/40 px-3 py-1 text-xs font-semibold text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-50'
                          : 'shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-page transition-transform hover:scale-105 active:scale-95 disabled:opacity-50'
                      }
                    >
                      {u.isFollowedByMe ? 'Following' : 'Follow'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
