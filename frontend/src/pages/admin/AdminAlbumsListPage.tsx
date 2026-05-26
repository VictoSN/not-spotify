import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { Album } from '@/types/album'
import { adminService } from '@/services/adminService'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function AdminAlbumsListPage() {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const reload = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setAlbums(await adminService.listAlbums())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleDelete = async (album: Album) => {
    if (!confirm(`Delete "${album.title}"? This cannot be undone.`)) return
    setDeletingId(album.id)
    setError(null)
    try {
      await adminService.deleteAlbum(album.id)
      setAlbums((prev) => prev.filter((a) => a.id !== album.id))
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
          <h1 className="text-3xl font-bold text-primary">Albums</h1>
          <p className="text-secondary text-sm mt-1">Manage all albums in the catalogue.</p>
        </div>
        <Button onClick={() => navigate('/admin/albums/new')}>
          <PlusCircleIcon className="w-5 h-5" />
          New album
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
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Released</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {albums.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-secondary">No albums yet.</td></tr>
              )}
              {albums.map((a) => (
                <tr key={a.id} className="border-b border-elevated/20 hover:bg-elevated/30 transition-colors">
                  <td className="px-4 py-3 w-16">
                    {a.coverUrl ? (
                      <img src={a.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-elevated" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/album/${a.id}`} className="text-primary font-medium hover:text-accent">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{a.artist.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-elevated text-secondary capitalize">
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{a.releaseDate}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/albums/${a.id}/edit`)}>
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
