import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayIcon } from '@heroicons/react/24/solid'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { useHueStore } from '@/stores/hueStore'
import { trackService } from '@/services/trackService'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDragStore } from '@/stores/dragStore'
import { ALBUM_DND_MIME, setAlbumDragImage } from '@/utils/trackDnd'
import { AlbumMenu, type AlbumMenuHandle } from './AlbumMenu'

interface AlbumCardProps {
  album: Album
  tracks?: Track[]
  flush?: boolean
}

export function AlbumCard({ album, tracks, flush = false }: AlbumCardProps) {
  const playWithGate = usePlaybackGate()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const setDraggedAlbum = useDragStore((s) => s.setDraggedAlbum)
  const menuTriggerRef = useRef<AlbumMenuHandle>(null)
  const [loading, setLoading] = useState(false)

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: album.coverUrl })
      return
    }
    if (tracks && tracks.length > 0) {
      playWithGate(tracks[0], tracks)
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const fetched = await trackService.getByAlbum(album.id)
      if (fetched.length > 0) playWithGate(fetched[0], fetched)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="group relative flex-shrink-0 w-40 sm:w-44 transition-opacity"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData(ALBUM_DND_MIME, album.id)
        e.dataTransfer.setData('text/plain', album.title)
        setAlbumDragImage(e, album)
        setDraggedAlbum(album)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        setDraggedAlbum(null)
        e.currentTarget.style.opacity = ''
      }}
      onMouseEnter={() => getDominantColor(album.coverUrl).then((c) => c && setHoverColor(c))}
      onMouseLeave={() => setHoverColor(null)}
      onContextMenu={(e) => {
        e.preventDefault()
        menuTriggerRef.current?.openAt(e.clientX, e.clientY)
      }}
    >
      <Link
        to={`/album/${album.id}`}
        draggable={false}
        className={`block rounded-lg transition-colors ${flush ? 'p-3 hover:bg-surface' : 'p-3 hover:bg-surface'}`}
      >
        <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
          <img src={album.coverUrl} alt={album.title} draggable={false} className="w-full h-full object-cover" />
          <button
            onClick={handlePlay}
            className="absolute bottom-2 right-2 w-10 h-10 bg-accent rounded-full flex items-center justify-center opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-105 disabled:opacity-60"
            aria-label={`Play ${album.title}`}
            disabled={loading}
          >
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          </button>
        </div>
        <p className="text-sm font-semibold text-primary truncate">{album.title}</p>
        <p className="text-xs text-secondary mt-0.5 truncate">
          {album.releaseDate.slice(0, 4)} ·{' '}
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              navigate(`/artist/${album.artist.id}`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                navigate(`/artist/${album.artist.id}`)
              }
            }}
            className="cursor-pointer hover:text-primary hover:underline"
          >
            {album.artist.name}
          </span>
        </p>
      </Link>

      <div
        className="hidden"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <AlbumMenu
          album={album}
          ref={menuTriggerRef}
          triggerClassName="rounded-full bg-black/60 p-1 text-white backdrop-blur-sm shadow-md"
          triggerIconClassName="h-5 w-5 text-white"
        />
      </div>
    </div>
  )
}
