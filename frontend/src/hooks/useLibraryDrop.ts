import { useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'
import { useDragStore } from '@/stores/dragStore'
import {
  ALBUM_DND_MIME,
  ARTIST_DND_MIME,
  PODCAST_DND_MIME,
  TRACK_DND_MIME,
  VIDEO_DND_MIME,
} from '@/utils/trackDnd'

type LibraryDropKind = 'track' | 'artist' | 'album' | 'video' | 'podcast'

interface LibraryDropHandlers {
  onDropTrack?: (track: Track) => void | Promise<void>
  onDropArtist?: (artist: Artist) => void | Promise<void>
  onDropAlbum?: (album: Album) => void | Promise<void>
  onDropVideo?: (video: MusicVideo) => void | Promise<void>
  onDropPodcast?: (podcast: PodcastSummary) => void | Promise<void>
}

/** Pure mapping from a drag event's MIME types to the library content kind. */
export function libraryDropKindFromTypes(types: readonly string[]): LibraryDropKind | null {
  if (types.includes(TRACK_DND_MIME)) return 'track'
  if (types.includes(ARTIST_DND_MIME)) return 'artist'
  if (types.includes(ALBUM_DND_MIME)) return 'album'
  if (types.includes(VIDEO_DND_MIME)) return 'video'
  if (types.includes(PODCAST_DND_MIME)) return 'podcast'
  return null
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
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('ns-track-drop-zone-over', clear)
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  const getDropKind = (e: React.DragEvent): LibraryDropKind | null =>
    libraryDropKindFromTypes(e.dataTransfer.types)

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

    const { draggedTrack, draggedArtist, draggedAlbum, draggedVideo, draggedPodcast } =
      useDragStore.getState()
    if (kind === 'track' && draggedTrack && handlers.onDropTrack) {
      void handlers.onDropTrack(draggedTrack)
    } else if (kind === 'artist' && draggedArtist && handlers.onDropArtist) {
      void handlers.onDropArtist(draggedArtist)
    } else if (kind === 'album' && draggedAlbum && handlers.onDropAlbum) {
      void handlers.onDropAlbum(draggedAlbum)
    } else if (kind === 'video' && draggedVideo && handlers.onDropVideo) {
      void handlers.onDropVideo(draggedVideo)
    } else if (kind === 'podcast' && draggedPodcast && handlers.onDropPodcast) {
      void handlers.onDropPodcast(draggedPodcast)
    }
  }

  return { isOver, dropProps: { onDragOver, onDragLeave, onDrop } }
}
