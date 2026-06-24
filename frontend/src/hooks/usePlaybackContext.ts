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
 * global player is currently playing. No card keeps its own local play state.
 *
 * Albums follow the current track's album id unless an explicit artist or mix
 * context owns playback. Artist/mix playback can queue album tracks, but it
 * must not make album UI look active.
 *
 * Everything else (artist/playlist/liked/mix) matches only the explicit playback
 * context. In particular, an artist or mix button must never light up just
 * because the current track happens to be inside that surface.
 */
export function usePlaybackContext(context: PlaybackContextInput | null): PlaybackContextState {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const ctxType = usePlayerStore((s) => s.currentContextType)
  const ctxId = usePlayerStore((s) => s.currentContextId)

  const isActiveContext = (() => {
    if (!context) return false
    const matchesContext = ctxType === context.type && ctxId === context.id
    // Albums derive from the current track, unless artist/mix playback owns the queue.
    if (context.type === 'album') {
      if (ctxType === 'artist' || ctxType === 'mix') return false
      return currentTrack?.album.id === context.id
    }
    // Artist / playlist / liked / mix react only to the explicit context.
    return matchesContext
  })()

  return { isActiveContext, isPlayingContext: isActiveContext && isPlaying }
}
