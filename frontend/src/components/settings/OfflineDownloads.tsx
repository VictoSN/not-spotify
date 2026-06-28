import { useCallback, useEffect, useState } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import {
  OFFLINE_CHANGE_EVENT,
  clearOffline,
  isOfflineSupported,
  listOffline,
  offlineTotalBytes,
  removeTrackOffline,
  type OfflineEntry,
} from '@/services/offlineAudio'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

/**
 * Settings panel listing tracks saved for offline playback, with per-track
 * remove and a clear-all. Renders nothing when offline storage is unsupported.
 *
 * `searchText` is unused at runtime — it exists so the Settings page search can
 * read keywords off this self-rendering section via its element props.
 */
export function OfflineDownloads({ searchText: _searchText }: { searchText?: string } = {}) {
  const [entries, setEntries] = useState<OfflineEntry[]>(() => listOffline())
  const [total, setTotal] = useState(() => offlineTotalBytes())

  const refresh = useCallback(() => {
    setEntries(listOffline())
    setTotal(offlineTotalBytes())
  }, [])

  useEffect(() => {
    window.addEventListener(OFFLINE_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, refresh)
  }, [refresh])

  if (!isOfflineSupported()) return null

  return (
    <section className="border-t border-elevated/40 py-6">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-primary">Offline downloads</h2>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => void clearOffline()}
            className="text-xs font-semibold text-secondary transition-colors hover:text-primary"
          >
            Clear all
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="py-2 text-sm text-secondary">
          No downloads yet. Use “Save for offline” from a song’s ⋯ menu (Premium)
          to keep it playable without a connection.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-secondary">
            {entries.length} {entries.length === 1 ? 'track' : 'tracks'} ·{' '}
            {formatBytes(total)} on this device
          </p>
          <ul className="divide-y divide-elevated/20">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                {e.coverUrl ? (
                  <img
                    src={e.coverUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-elevated text-xs">
                    🎵
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{e.title}</p>
                  <p className="truncate text-xs text-secondary">{e.artist}</p>
                </div>
                <span className="shrink-0 text-xs text-secondary">{formatBytes(e.bytes)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${e.title} download`}
                  onClick={() => void removeTrackOffline(e.id)}
                  className="shrink-0 rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-primary"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
