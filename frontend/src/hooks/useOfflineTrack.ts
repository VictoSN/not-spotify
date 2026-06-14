import { useCallback, useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import {
  OFFLINE_CHANGE_EVENT,
  isOfflineSupported,
  isTrackSaved,
  removeTrackOffline,
  saveTrackOffline,
} from '@/services/offlineAudio'

/**
 * Tracks whether a single track is saved for offline and exposes a toggle.
 * Subscribes to the global change event so every menu/row stays in sync.
 */
export function useOfflineTrack(track: Track) {
  const supported = isOfflineSupported()
  const [saved, setSaved] = useState(() => isTrackSaved(track.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setSaved(isTrackSaved(track.id))
    sync()
    window.addEventListener(OFFLINE_CHANGE_EVENT, sync)
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, sync)
  }, [track.id])

  const toggle = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (isTrackSaved(track.id)) await removeTrackOffline(track.id)
      else await saveTrackOffline(track)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update offline download.')
    } finally {
      setBusy(false)
    }
  }, [track])

  return { supported, saved, busy, error, toggle }
}
