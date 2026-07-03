import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StarIcon as StarOutline, TrashIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { Spinner } from '@/components/ui/Spinner'
import { AdminTableSkeleton } from '@/components/common/AdminSkeleton'
import { SearchInput } from '@/components/common/SearchInput'
import { notify } from '@/utils/toast'
import { useDebounce } from '@/hooks/useDebounce'
import { useConfirm } from '@/hooks/useConfirm'
import { adminPageClass } from './adminPageLayout'

export function AdminPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [actingId, setActingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const confirm = useConfirm()

  const reload = async (q?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await playlistService.adminList(q || undefined)
      setPlaylists(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { reload(debouncedSearch) }, [debouncedSearch])

  const toggleFeatured = async (p: Playlist) => {
    setActingId(p.id)
    try {
      const updated = await playlistService.setFeatured(p.id, !p.isFeatured, undefined)
      setPlaylists((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)))
      notify.success(updated.isFeatured ? `"${p.name}" is now featured` : `"${p.name}" is no longer featured`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to update featured status')
    } finally {
      setActingId(null)
    }
  }

  const handleDelete = async (p: Playlist) => {
    const ok = await confirm({
      title: `Delete "${p.name}"?`,
      message: `This playlist (${p.tracks?.length ?? 0} tracks, owned by ${p.owner.name}) will be removed from the platform. It is soft-deleted and stays recoverable for 30 days.`,
      confirmText: 'Delete playlist',
      danger: true,
    })
    if (!ok) return
    setDeletingId(p.id)
    try {
      await playlistService.adminDelete(p.id)
      setPlaylists((prev) => prev.filter((x) => x.id !== p.id))
      notify.success(`"${p.name}" deleted`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to delete playlist')
    } finally {
      setDeletingId(null)
    }
  }

  const setSortOrder = async (p: Playlist, value: number) => {
    setActingId(p.id)
    try {
      const updated = await playlistService.setFeatured(p.id, undefined, value)
      setPlaylists((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to update sort order')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className={adminPageClass}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Playlists</h1>
          <p className="text-secondary text-sm mt-1">
            Feature playlists for the homepage and browse pages. Featured playlists appear first, ordered by sort number (lower = first).
          </p>
        </div>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search playlists by name or owner…"
        className="mb-4 max-w-md"
        ariaLabel="Search playlists"
      />

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs font-semibold">✕</button>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={6} columns={5} />
      ) : playlists.length === 0 ? (
        <div className="bg-surface rounded-lg border border-elevated/40 px-6 py-12 text-center text-secondary text-sm">
          {search ? 'No playlists match that search.' : 'No playlists yet.'}
        </div>
      ) : (
        <div className="bg-surface border border-elevated/40 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-elevated/30 bg-elevated/10">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-secondary">Playlist</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-secondary">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-secondary">Tracks</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-secondary">Visibility</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-secondary">Featured</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-secondary">Sort #</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map((p) => (
                <tr key={p.id} className="border-b border-elevated/10 hover:bg-elevated/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/playlist/${p.id}`} className="flex items-center gap-3 min-w-0 group">
                      {p.coverUrl ? (
                        <img src={p.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-elevated shrink-0 flex items-center justify-center text-muted text-xs font-bold">
                          {p.name[0]?.toUpperCase() ?? 'P'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-primary truncate block group-hover:underline">
                          {p.name}
                        </span>
                        {p.description && (
                          <span className="text-xs text-secondary truncate block">{p.description}</span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary">{p.owner.name}</td>
                  <td className="px-4 py-3 text-sm text-secondary">{p.tracks?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                      p.visibility === 'public' ? 'bg-green-500/15 text-green-400' :
                      p.visibility === 'friends' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-elevated text-secondary'
                    }`}>
                      {p.visibility ?? 'public'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(p)}
                      disabled={actingId === p.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-elevated/60 transition-colors"
                      title={p.isFeatured ? 'Unfeature' : 'Feature'}
                    >
                      {actingId === p.id ? (
                        <Spinner size="sm" />
                      ) : p.isFeatured ? (
                        <StarSolid className="w-5 h-5 text-accent" />
                      ) : (
                        <StarOutline className="w-5 h-5 text-secondary hover:text-accent" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={p.sortOrder ?? 0}
                      disabled={actingId === p.id}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 0) setSortOrder(p, v)
                      }}
                      className="w-16 bg-elevated border border-elevated/50 focus:border-accent text-primary text-sm text-center rounded px-2 py-1 focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-secondary hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete playlist"
                      aria-label={`Delete playlist ${p.name}`}
                    >
                      {deletingId === p.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
