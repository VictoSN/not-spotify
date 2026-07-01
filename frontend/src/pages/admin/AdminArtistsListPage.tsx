import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirm } from '@/hooks/useConfirm'
import {
  PlusCircleIcon, PencilSquareIcon, TrashIcon, CheckBadgeIcon,
  NoSymbolIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import type { Artist } from '@/types/artist'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AdminTableSkeleton } from '@/components/common/AdminSkeleton'
import { SearchInput } from '@/components/common/SearchInput'
import { useDebounce } from '@/hooks/useDebounce'

export function AdminArtistsListPage() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [artists, setArtists] = useState<Artist[]>([])
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Revoke note input state
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [revokeNote, setRevokeNote] = useState('')

  const reload = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setArtists(await adminService.listArtists())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artists')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const visibleArtists = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return artists
    return artists.filter((a) => a.name.toLowerCase().includes(q))
  }, [artists, debouncedQuery])

  const handleDelete = async (artist: Artist) => {
    if (!(await confirm({
      title: `Delete "${artist.name}"?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    setDeletingId(artist.id)
    setError(null)
    try {
      await adminService.deleteArtist(artist.id)
      setArtists((prev) => prev.filter((a) => a.id !== artist.id))
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? (err instanceof Error ? err.message : 'Delete failed'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setActingId(revokeTarget)
    setError(null)
    try {
      const updated = await adminService.revokeArtist(revokeTarget, revokeNote || undefined)
      setArtists((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setRevokeTarget(null)
      setRevokeNote('')
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? 'Failed to revoke artist.')
    } finally {
      setActingId(null)
    }
  }

  const handleSyncTours = async () => {
    setSyncing(true)
    setError(null)
    setNotice(null)
    try {
      const count = await adminService.syncAllTours()
      setNotice(count > 0
        ? `Refreshed live tour dates for ${count} artist${count === 1 ? '' : 's'}.`
        : 'Tour dates are already up to date (or Ticketmaster is not configured).')
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? (err instanceof Error ? err.message : 'Tour sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  const handleReinstate = async (id: string) => {
    if (!(await confirm({
      title: 'Reinstate this artist?',
      message: 'They will be able to submit content again.',
      confirmText: 'Reinstate',
    }))) return
    setActingId(id)
    setError(null)
    try {
      const updated = await adminService.reinstateArtist(id)
      setArtists((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? 'Failed to reinstate artist.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Artists</h1>
          <p className="text-secondary text-sm mt-1">Manage all artists in the catalogue.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" onClick={handleSyncTours} disabled={syncing} title="Refresh live concert dates from Ticketmaster">
            {syncing ? <Spinner size="sm" /> : <ArrowPathIcon className="w-5 h-5" />}
            Sync tour dates
          </Button>
          <Button onClick={() => navigate('/admin/artists/new')}>
            <PlusCircleIcon className="w-5 h-5" />
            New artist
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {notice && (
        <div className="mb-4 bg-accent/10 border border-accent/30 rounded-md px-4 py-3">
          <p className="text-accent text-sm">{notice}</p>
        </div>
      )}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search artists by name…"
        className="mb-4 max-w-md"
        ariaLabel="Search artists"
      />

      {isLoading ? (
        <AdminTableSkeleton rows={6} columns={5} />
      ) : (
        <div className="bg-surface rounded-lg border border-elevated/40 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-elevated/40">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Monthly listeners</th>
                <th className="px-4 py-3">Followers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleArtists.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-secondary">
                  {debouncedQuery.trim() ? 'No results found.' : 'No artists yet.'}
                </td></tr>
              )}
              {visibleArtists.map((a) => (
                <>
                  <tr key={a.id} className={`border-b border-elevated/20 hover:bg-elevated/30 transition-colors ${a.isRevoked ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 w-16">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-elevated" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/artist/${a.id}`} className="text-primary font-medium hover:text-accent">
                          {a.name}
                        </Link>
                        {a.verified && <CheckBadgeIcon className="w-4 h-4 text-accent" />}
                        {a.isRevoked && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">
                            Revoked
                          </span>
                        )}
                      </div>
                      {a.isRevoked && a.revocationNote && (
                        <p className="text-xs text-red-400/70 italic mt-0.5">Reason: {a.revocationNote}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary text-sm">{a.monthlyListeners.toLocaleString()}</td>
                    <td className="px-4 py-3 text-secondary text-sm">{a.followerCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2 flex-wrap justify-end">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/artists/${a.id}/edit`)}>
                          <PencilSquareIcon className="w-4 h-4" />
                          Edit
                        </Button>
                        {a.isRevoked ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReinstate(a.id)}
                            disabled={actingId === a.id}
                          >
                            {actingId === a.id ? <Spinner size="sm" /> : <ArrowPathIcon className="w-4 h-4" />}
                            Reinstate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setRevokeTarget(a.id); setRevokeNote('') }}
                            disabled={actingId === a.id}
                            className="text-red-400 hover:text-red-300"
                          >
                            <NoSymbolIcon className="w-4 h-4" />
                            Revoke
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(a)}
                          disabled={deletingId === a.id}
                        >
                          {deletingId === a.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline revoke note panel */}
                  {revokeTarget === a.id && (
                    <tr key={`${a.id}-revoke`} className="border-b border-elevated/20 bg-red-500/5">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-col gap-2 max-w-lg">
                          <label className="text-sm font-semibold text-red-400">
                            Revoke "{a.name}" — optional reason
                          </label>
                          <textarea
                            autoFocus
                            rows={2}
                            value={revokeNote}
                            onChange={(e) => setRevokeNote(e.target.value)}
                            placeholder="Reason for revocation (shown to artist)…"
                            className="w-full bg-elevated border border-red-500/30 focus:border-red-400 text-primary placeholder:text-muted rounded px-3 py-2 text-sm resize-none focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setRevokeTarget(null); setRevokeNote('') }}
                              className="px-3 py-1.5 rounded text-sm font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleRevoke}
                              disabled={actingId === a.id}
                              className="px-3 py-1.5 rounded text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                            >
                              {actingId === a.id ? <Spinner size="sm" /> : 'Confirm Revoke'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
