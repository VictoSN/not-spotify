import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AdminTracksListPage() {
  const navigate = useNavigate()
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const reload = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setTracks(await adminService.listTracks())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleDelete = async (track: Track) => {
    if (!confirm(`Delete "${track.title}"? This cannot be undone.`)) return
    setDeletingId(track.id)
    setError(null)
    try {
      await adminService.deleteTrack(track.id)
      setTracks((prev) => prev.filter((t) => t.id !== track.id))
    } catch (err) {
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? (err instanceof Error ? err.message : 'Delete failed'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Tracks</h1>
          <p className="text-secondary text-sm mt-1">Manage all tracks in the catalogue.</p>
        </div>
        <Button onClick={() => navigate('/admin/tracks/new')}>
          <PlusCircleIcon className="w-5 h-5" />
          New track
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-surface rounded-lg overflow-hidden border border-elevated/40">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-elevated/40">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Album</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-secondary">No tracks yet.</td></tr>
              )}
              {tracks.map((t) => (
                <tr key={t.id} className="border-b border-elevated/20 hover:bg-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-secondary text-sm">{t.trackNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-medium">{t.title}</span>
                      {t.explicit && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-elevated text-secondary font-mono">E</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{t.artist.name}</td>
                  <td className="px-4 py-3 text-secondary text-sm">{t.album.title}</td>
                  <td className="px-4 py-3 text-secondary text-sm">{fmtDuration(t.durationMs)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/tracks/${t.id}/edit`)}>
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id}
                      >
                        {deletingId === t.id ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                        Delete
                      </Button>
                    </div>
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
