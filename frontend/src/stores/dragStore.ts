import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'

/**
 * Tracks content currently being dragged (HTML5 drag-and-drop). The dataTransfer
 * payload only carries ids as strings; the full objects live here so drop targets
 * can act on them synchronously.
 */
interface DragState {
  draggedTrack: Track | null
  draggedArtist: Artist | null
  draggedAlbum: Album | null
  setDraggedTrack: (track: Track | null) => void
  setDraggedArtist: (artist: Artist | null) => void
  setDraggedAlbum: (album: Album | null) => void
}

export const useDragStore = create<DragState>((set) => ({
  draggedTrack: null,
  draggedArtist: null,
  draggedAlbum: null,
  setDraggedTrack: (track) => set({ draggedTrack: track }),
  setDraggedArtist: (artist) => set({ draggedArtist: artist }),
  setDraggedAlbum: (album) => set({ draggedAlbum: album }),
}))
