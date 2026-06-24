import type { Track } from '@/types/track'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlayerStore } from '@/stores/playerStore'
import type { PlaybackContextInput } from '@/hooks/usePlaybackContext'

export function usePlaybackGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const play = usePlayerStore((s) => s.play)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

  return (track: Track, queue?: Track[]) => {
    if (!isAuthenticated) {
      openAuthPrompt({
        title: 'Start listening with a free account',
        imageUrl: track.album.coverUrl,
      })
      return false
    }

    play(track, queue)
    return true
  }
}

/**
 * Auth-gated wrapper around `playContext` — starts an album/playlist/artist/liked
 * queue (from `startIndex`) while keeping the global `currentContext` in sync so
 * the matching play buttons flip to pause.
 */
export function usePlayContextGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const playContext = usePlayerStore((s) => s.playContext)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

  return (context: PlaybackContextInput, tracks: Track[], startIndex = 0) => {
    const track = tracks[startIndex]
    if (!track) return false
    if (!isAuthenticated) {
      openAuthPrompt({
        title: 'Start listening with a free account',
        imageUrl: track.album.coverUrl,
      })
      return false
    }
    playContext(context, tracks, startIndex)
    return true
  }
}
