import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'
import type { Artist } from '@/types/artist'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function AdminArtistsListPage() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const handleDelete = async (artist: Artist) => {
    if (!confirm(`Delete "${artist.name}"? This cannot be undone.`)) return
    setDeletingId(artist.id)
    setError(null)
    try {
      await adminService.deleteArtist(artist.id)
      setArtists((prev) => prev.filter((a) => a.id !== artist.id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      // Axios error → try to extract server message
      const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg ?? msg)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Artists</h1>
          <p className="text-secondary text-sm mt-1">Manage all artists in the catalogue.</p>
        </div>
        <Button onClick={() => navigate('/admin/artists/new')}>
          <PlusCircleIcon className="w-5 h-5" />
          New artist
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
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Monthly listeners</th>
                <th className="px-4 py-3">Followers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {artists.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-secondary">No artists yet.</td></tr>
              )}
              {artists.map((a) => (
                <tr key={a.id} className="border-b border-elevated/20 hover:bg-elevated/30 transition-colors">
                  <td className="px-4 py-3 w-16">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-elevated" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/artist/${a.id}`} className="text-primary font-medium hover:text-accent">
                        {a.name}
                      </Link>
                      {a.verified && <CheckBadgeIcon className="w-4 h-4 text-accent" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{a.monthlyListeners.toLocaleString()}</td>
                  <td className="px-4 py-3 text-secondary text-sm">{a.followerCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/artists/${a.id}/edit`)}
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </Button>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
