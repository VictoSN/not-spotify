import { create } from 'zustand'
import type { Track } from '@/types/track'

/**
 * Tracks the song currently being dragged (HTML5 drag-and-drop). The dataTransfer
 * payload only carries the track id as a string; the full Track object lives here so
 * drop targets (sidebar playlists, Liked Songs) can act on it synchronously, and so
 * valid targets can light up green for the duration of the drag.
 */
interface DragState {
  draggedTrack: Track | null
  setDraggedTrack: (track: Track | null) => void
}

export const useDragStore = create<DragState>((set) => ({
  draggedTrack: null,
  setDraggedTrack: (track) => set({ draggedTrack: track }),
}))
