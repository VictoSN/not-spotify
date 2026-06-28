import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Artist } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { formatNumber } from '@/utils/formatNumber'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useDragStore } from '@/stores/dragStore'
import { ARTIST_DND_MIME, setArtistDragImage } from '@/utils/trackDnd'
import { ArtistMenu, type ArtistMenuHandle } from './ArtistMenu'
import { CardPlayButton } from './CardPlayButton'

interface ArtistCardProps {
  artist: Artist
  flush?: boolean
  /** Render the name bold. Defaults to normal weight (Spotify-style); pass true where bold is wanted. */
  boldTitle?: boolean
}

export function ArtistCard({ artist, flush = false, boldTitle = false }: ArtistCardProps) {
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'artist', id: artist.id })
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const setDraggedArtist = useDragStore((s) => s.setDraggedArtist)
  const menuTriggerRef = useRef<ArtistMenuHandle>(null)
  const [loading, setLoading] = useState(false)

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isActiveContext) {
      togglePlayPause()
      return
    }
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Start listening with a free account', imageUrl: artist.imageUrl })
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const tracks = await artistService.getTopTracks(artist.id, 20)
      if (tracks.length > 0) startContext({ type: 'artist', id: artist.id }, tracks)
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
        e.dataTransfer.setData(ARTIST_DND_MIME, artist.id)
        e.dataTransfer.setData('text/plain', artist.name)
        setArtistDragImage(e, artist)
        setDraggedArtist(artist)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        setDraggedArtist(null)
        e.currentTarget.style.opacity = ''
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        menuTriggerRef.current?.openAt(e.clientX, e.clientY)
      }}
    >
      <Link
        to={`/artist/${artist.id}`}
        draggable={false}
        className={`block rounded-lg transition-colors ${flush ? 'p-3 text-left hover:bg-surface' : 'p-3 text-center hover:bg-surface'}`}
      >
        <div className={`relative mb-3 aspect-square ${flush ? '' : 'mx-auto'}`}>
          <div className="h-full w-full overflow-hidden rounded-full bg-elevated shadow-lg">
            {artist.imageUrl ? (
              <img
                src={artist.imageUrl}
                alt={artist.name}
                draggable={false}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl">A</div>
            )}
          </div>
          <CardPlayButton
            variant="artist"
            onClick={handlePlay}
            isPlaying={isPlayingContext}
            isActive={isActiveContext}
            ariaLabel={isPlayingContext ? `Pause ${artist.name}` : `Play ${artist.name}`}
            disabled={loading}
          />
        </div>
        <p className={`text-sm ${boldTitle ? 'font-semibold' : 'font-normal'} text-primary truncate`}>{artist.name}</p>
        <p className="text-xs text-secondary mt-0.5">{formatNumber(artist.monthlyListeners)} listeners</p>
      </Link>

      <div
        className="hidden"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <ArtistMenu
          artist={artist}
          ref={menuTriggerRef}
          triggerClassName="rounded-full bg-black/60 p-1 text-white backdrop-blur-sm shadow-md"
          triggerIconClassName="h-5 w-5 text-white"
        />
      </div>
    </div>
  )
}
