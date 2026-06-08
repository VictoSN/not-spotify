import type { Track } from '@/types/track'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { usePlayerStore } from '@/stores/playerStore'

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
