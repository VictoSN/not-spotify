import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlassIcon, StarIcon as StarOutline } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/utils/toast'

export function AdminPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

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

  useEffect(() => { reload() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    reload(search)
  }

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Playlists</h1>
          <p className="text-secondary text-sm mt-1">
            Feature playlists for the homepage and browse pages. Featured playlists appear first, ordered by sort number (lower = first).
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2 max-w-md">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlists…"
            className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-accent text-black text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs font-semibold">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
