import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import { useDragStore } from '@/stores/dragStore'
import { ALBUM_DND_MIME, ARTIST_DND_MIME, TRACK_DND_MIME } from '@/utils/trackDnd'

type LibraryDropKind = 'track' | 'artist' | 'album'

interface LibraryDropHandlers {
  onDropTrack?: (track: Track) => void | Promise<void>
  onDropArtist?: (artist: Artist) => void | Promise<void>
  onDropAlbum?: (album: Album) => void | Promise<void>
}

/**
 * Turns the library itself into a drop target for content that can be saved there.
 * Tracks map to Liked Songs; artists map to followed artists; releases map to
 * saved albums/singles.
 */
export function useLibraryDrop(canDrop: boolean, handlers: LibraryDropHandlers) {
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const clear = () => setIsOver(false)
    window.addEventListener('ns-track-drop-zone-over', clear)
    return () => window.removeEventListener('ns-track-drop-zone-over', clear)
  }, [])

  const getDropKind = (e: React.DragEvent): LibraryDropKind | null => {
    if (e.dataTransfer.types.includes(TRACK_DND_MIME)) return 'track'
    if (e.dataTransfer.types.includes(ARTIST_DND_MIME)) return 'artist'
    if (e.dataTransfer.types.includes(ALBUM_DND_MIME)) return 'album'
    return null
  }

  const onDragOver = (e: React.DragEvent) => {
    const kind = canDrop ? getDropKind(e) : null
    if (!kind) return
    if ((e.target as Element | null)?.closest('[data-track-drop-zone="true"]')) {
      if (isOver) setIsOver(false)
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isOver) setIsOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    const kind = canDrop ? getDropKind(e) : null
    if (!kind) return
    e.preventDefault()
    setIsOver(false)

    const { draggedTrack, draggedArtist, draggedAlbum } = useDragStore.getState()
    if (kind === 'track' && draggedTrack && handlers.onDropTrack) {
      void handlers.onDropTrack(draggedTrack)
    } else if (kind === 'artist' && draggedArtist && handlers.onDropArtist) {
      void handlers.onDropArtist(draggedArtist)
    } else if (kind === 'album' && draggedAlbum && handlers.onDropAlbum) {
      void handlers.onDropAlbum(draggedAlbum)
    }
  }

  return { isOver, dropProps: { onDragOver, onDragLeave, onDrop } }
}
