import { useRef, useEffect } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import type { Track } from '@/types/track'

interface TrackActionsMenuProps {
  track: Track
  isOpen: boolean
  onClose: () => void
}

export function TrackActionsMenu({ track, isOpen, onClose }: TrackActionsMenuProps) {
  const { savedPlaylists, addTrackToPlaylist } = useLibraryStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAddToPlaylist = (playlistId: string) => {
    addTrackToPlaylist(playlistId, track)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-[1000] mt-1 w-48 bg-elevated rounded-lg shadow-xl border border-secondary/20 overflow-hidden"
    >
      {savedPlaylists.length === 0 ? (
        <div className="px-4 py-3 text-sm text-secondary text-center">
          Create a playlist first
        </div>
      ) : (
        <>
          <div className="px-4 py-2 text-xs font-semibold text-secondary uppercase tracking-wider border-b border-secondary/10">
            Add to playlist
          </div>
          <div className="max-h-64 overflow-y-auto">
            {savedPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handleAddToPlaylist(playlist.id)}
                className="w-full px-4 py-2.5 text-left text-sm text-primary hover:bg-surface transition-colors flex items-start gap-2"
              >
                <span className="flex-1 truncate">{playlist.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
