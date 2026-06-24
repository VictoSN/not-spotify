import { usePlayerStore, type PlayContextType } from '@/stores/playerStore'

/** A surface (album/playlist/artist/liked card or page) that can be played. */
export interface PlaybackContextInput {
  type: PlayContextType
  id: string
}

export interface PlaybackContextState {
  /** This surface is the current playback context (playing OR paused). */
  isActiveContext: boolean
  /** This surface is the current context AND audio is actually playing. */
  isPlayingContext: boolean
}

/**
 * Derives whether a given album/playlist/artist/liked surface is the one the
 * global player is currently playing — the single source of truth for every
 * play/pause button in the app. No card keeps its own local play state.
 *
 * Albums/artists match on the current track's own album/artist id (so playing
 * any track of the album lights its button), and also on the explicit context.
 * Playlists/liked match only on the explicit context, since a track can belong
 * to many playlists.
 */
export function usePlaybackContext(context: PlaybackContextInput | null): PlaybackContextState {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const ctxType = usePlayerStore((s) => s.currentContextType)
  const ctxId = usePlayerStore((s) => s.currentContextId)

  const isActiveContext = (() => {
    if (!context) return false
    const matchesContext = ctxType === context.type && ctxId === context.id
    switch (context.type) {
      case 'album':
        return currentTrack?.album.id === context.id || matchesContext
      case 'artist':
        return currentTrack?.artist.id === context.id || matchesContext
      default:
        return matchesContext
    }
  })()

  return { isActiveContext, isPlayingContext: isActiveContext && isPlaying }
}
