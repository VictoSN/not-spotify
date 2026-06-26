import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { MusicVideo } from '@/types/musicVideo'
import type { PodcastSummary } from '@/types/podcast'

/**
 * Tracks content currently being dragged (HTML5 drag-and-drop). The dataTransfer
 * payload only carries ids as strings; the full objects live here so drop targets
 * can act on them synchronously.
 */
interface DragState {
  draggedTrack: Track | null
  draggedArtist: Artist | null
  draggedAlbum: Album | null
  draggedVideo: MusicVideo | null
  draggedPodcast: PodcastSummary | null
  setDraggedTrack: (track: Track | null) => void
  setDraggedArtist: (artist: Artist | null) => void
  setDraggedAlbum: (album: Album | null) => void
  setDraggedVideo: (video: MusicVideo | null) => void
  setDraggedPodcast: (podcast: PodcastSummary | null) => void
}

export const useDragStore = create<DragState>((set) => ({
  draggedTrack: null,
  draggedArtist: null,
  draggedAlbum: null,
  draggedVideo: null,
  draggedPodcast: null,
  setDraggedTrack: (track) => set({ draggedTrack: track }),
  setDraggedArtist: (artist) => set({ draggedArtist: artist }),
  setDraggedAlbum: (album) => set({ draggedAlbum: album }),
  setDraggedVideo: (video) => set({ draggedVideo: video }),
  setDraggedPodcast: (podcast) => set({ draggedPodcast: podcast }),
}))
