import { useCallback, useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import {
  OFFLINE_CHANGE_EVENT,
  isOfflineSupported,
  isTrackSaved,
  removeTrackOffline,
  saveTrackOffline,
} from '@/services/offlineAudio'
import { notify } from '@/utils/toast'

/**
 * Tracks whether a single track is saved for offline and exposes a toggle.
 * Subscribes to the global change event so every menu/row stays in sync.
 */
export function useOfflineTrack(track: Track) {
  const supported = isOfflineSupported()
  const [saved, setSaved] = useState(() => isTrackSaved(track.id))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = () => setSaved(isTrackSaved(track.id))
    sync()
    window.addEventListener(OFFLINE_CHANGE_EVENT, sync)
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, sync)
  }, [track.id])

  const toggle = useCallback(async () => {
    setBusy(true)
    try {
      if (isTrackSaved(track.id)) {
        await removeTrackOffline(track.id)
        notify.success('Removed download')
      } else {
        await saveTrackOffline(track)
        notify.success(`Saved “${track.title}” for offline`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not update offline download.')
    } finally {
      setBusy(false)
    }
  }, [track])

  return { supported, saved, busy, toggle }
}
