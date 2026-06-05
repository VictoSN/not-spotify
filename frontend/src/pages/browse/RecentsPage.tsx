import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon } from '@heroicons/react/24/outline'
import { meService, type PlayHistoryItem } from '@/services/meService'
import { useAuthStore } from '@/stores/authStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { Spinner } from '@/components/ui/Spinner'
import { formatMs } from '@/utils/formatTime'

export function RecentsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const playWithGate = usePlaybackGate()
  const [history, setHistory] = useState<PlayHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    meService.getHistory(50).then(setHistory).finally(() => setLoading(false))
  }, [isAuthenticated])

  const tracks = history.map((row) => row.track)

  return (
    <div className="px-6 py-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Listening history</h1>
      {!isAuthenticated ? (
        <p className="text-secondary">
          <Link to="/login" className="text-primary underline">Log in</Link> to see what you've been listening to.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : history.length === 0 ? (
        <p className="text-secondary">No recent plays yet. Hit play on something!</p>
      ) : (
        <div className="rounded-lg bg-surface p-2">
          {history.map((row, index) => (
            <HistoryRow
              key={`${row.track.id}-${row.playedAt}-${index}`}
              item={row}
              index={index}
              onPlay={() => playWithGate(row.track, tracks)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryRow({
  item,
  index,
  onPlay,
}: {
  item: PlayHistoryItem
  index: number
  onPlay: () => void
}) {
  return (
    <button
      onClick={onPlay}
      className="group grid w-full grid-cols-[28px_minmax(0,1fr)_70px] items-center gap-4 rounded-md px-4 py-2 text-left transition-colors hover:bg-elevated/60 sm:grid-cols-[28px_minmax(0,1fr)_160px_70px]"
    >
      <span className="flex h-7 w-7 items-center justify-center text-sm text-secondary">
        <span className="group-hover:hidden">{index + 1}</span>
        <PlayIcon className="hidden h-4 w-4 text-primary group-hover:block" />
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <img src={item.track.album.coverUrl} alt={item.track.album.title} className="h-10 w-10 rounded object-cover" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-primary">{item.track.title}</span>
          <span className="block truncate text-xs text-secondary">{item.track.artist.name}</span>
        </span>
      </span>
      <span className="hidden text-sm text-secondary sm:block">{new Date(item.playedAt).toLocaleString()}</span>
      <span className="text-right text-sm text-secondary">{formatMs(item.track.durationMs)}</span>
    </button>
  )
}
