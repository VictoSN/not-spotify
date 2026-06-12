import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useAuthStore } from '@/stores/authStore'

/**
 * Global player shortcuts (desktop):
 *   Space            play / pause
 *   ← / →            seek −5 s / +5 s
 *   Ctrl/Cmd + ← / → previous / next track
 *   Shift + ↑ / ↓    volume up / down
 *   M                mute toggle
 *   L                like / unlike the current track
 *
 * Disabled while typing in inputs/textareas/selects/contenteditable, and
 * Space is left alone when a button/link has focus (it activates it).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return

      const s = usePlayerStore.getState()

      switch (e.key) {
        case ' ': {
          if (tag === 'BUTTON' || tag === 'A') return
          if (!s.currentTrack) return
          e.preventDefault()
          s.togglePlayPause()
          break
        }
        case 'ArrowRight': {
          if (!s.currentTrack) return
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) s.skipNext()
          else s.seek(Math.min(s.duration || Infinity, s.currentTime + 5))
          break
        }
        case 'ArrowLeft': {
          if (!s.currentTrack) return
          e.preventDefault()
          if (e.ctrlKey || e.metaKey) s.skipPrevious()
          else s.seek(Math.max(0, s.currentTime - 5))
          break
        }
        case 'ArrowUp': {
          if (!e.shiftKey) return
          e.preventDefault()
          s.setVolume(s.volume + 0.1)
          break
        }
        case 'ArrowDown': {
          if (!e.shiftKey) return
          e.preventDefault()
          s.setVolume(s.volume - 0.1)
          break
        }
        case 'm':
        case 'M': {
          if (e.ctrlKey || e.metaKey || e.altKey) return
          s.toggleMute()
          break
        }
        case 'l':
        case 'L': {
          if (e.ctrlKey || e.metaKey || e.altKey) return
          const track = s.currentTrack
          if (!track || !useAuthStore.getState().isAuthenticated) return
          const lib = useLibraryStore.getState()
          if (lib.likedTrackIds.has(track.id)) void lib.unlikeTrack(track.id)
          else void lib.likeTrack(track)
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
