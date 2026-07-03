import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import { usePlayerStore } from '@/stores/playerStore'
import { useHueStore } from '@/stores/hueStore'
import { trackService } from '@/services/trackService'
import { getDominantColor } from '@/hooks/useDominantColor'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDragStore } from '@/stores/dragStore'
import { ALBUM_DND_MIME, setAlbumDragImage } from '@/utils/trackDnd'
import { AlbumMenu, type AlbumMenuHandle } from './AlbumMenu'
import { CardPlayButton } from './CardPlayButton'
import { cn } from '@/utils/cn'

interface AlbumCardProps {
  album: Album
  tracks?: Track[]
  flush?: boolean
  /** Fill a responsive grid cell instead of using the standard carousel width. */
  fluid?: boolean
  /** Render the title bold. Defaults to normal weight (Spotify-style); pass true where bold is wanted. */
  boldTitle?: boolean
}

export function AlbumCard({ album, tracks, flush = false, fluid = false, boldTitle = false }: AlbumCardProps) {
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'album', id: album.id })
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setDraggedAlbum = useDragStore((s) => s.setDraggedAlbum)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  const setLastCoverColor = useHueStore((s) => s.setLastCoverColor)
  const menuTriggerRef = useRef<AlbumMenuHandle>(null)
  const [loading, setLoading] = useState(false)

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isActiveContext) {
      togglePlayPause()
      return
    }
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: album.coverUrl })
      return
    }
    if (tracks && tracks.length > 0) {
      startContext({ type: 'album', id: album.id }, tracks)
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const fetched = await trackService.getByAlbum(album.id)
      if (fetched.length > 0) startContext({ type: 'album', id: album.id }, fetched)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative min-w-0 transition-opacity',
        fluid ? 'w-full' : 'w-40 flex-shrink-0 sm:w-44',
      )}
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
      onContextMenu={(e) => {
        e.preventDefault()
        menuTriggerRef.current?.openAt(e.clientX, e.clientY)
      }}
      onMouseEnter={() => {
        if (album.coverUrl) {
          getDominantColor(album.coverUrl).then((c) => {
            if (c) { setHoverColor(c); setLastCoverColor(c) }
          })
        } else {
          setHoverColor('hsl(0 0% 33%)')
        }
      }}
      onMouseLeave={() => setHoverColor(null)}
    >
      <Link
        to={`/album/${album.id}`}
        draggable={false}
        className={`block rounded-lg transition-colors ${flush ? 'p-3 hover:bg-surface' : 'p-3 hover:bg-surface'}`}
      >
        <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
          <img src={album.coverUrl} alt={album.title} draggable={false} className="w-full h-full object-cover" />
          <CardPlayButton
            onClick={handlePlay}
            isPlaying={isPlayingContext}
            isActive={isActiveContext}
            ariaLabel={isPlayingContext ? `Pause ${album.title}` : `Play ${album.title}`}
            disabled={loading}
          />
        </div>
        <p className={`text-sm ${boldTitle ? 'font-semibold' : 'font-normal'} text-primary truncate`}>{album.title}</p>
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
