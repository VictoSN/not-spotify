import { useCallback, useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import {
  OFFLINE_CHANGE_EVENT,
  canUseOfflineAudio,
  isOfflineSupported,
  isTrackSavedIndividually,
  removeTrackOffline,
  saveTrackOffline,
} from '@/services/offlineAudio'
import { notify } from '@/utils/toast'
import { isDesktop } from '@/utils/platform'

/**
 * Tracks whether a single track is saved for offline and exposes a toggle.
 * Subscribes to the global change event so every menu/row stays in sync.
 *
 * Offline downloads are a desktop-app feature. In the browser the action is
 * still surfaced (so users discover it) but disabled — `available` is false and
 * `desktopOnly` is true, letting the UI render a grayed-out "Available in the
 * desktop app" affordance. `toggle` no-ops when unavailable.
 */
export function useOfflineTrack(track: Track) {
  const desktopOnly = !isDesktop()
  const available = isOfflineSupported() && !desktopOnly && canUseOfflineAudio()
  // Kept for backwards-compatible call sites; equals `available`.
  const supported = available
  const [saved, setSaved] = useState(() => isTrackSavedIndividually(track.id))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = () => setSaved(isTrackSavedIndividually(track.id))
    sync()
    window.addEventListener(OFFLINE_CHANGE_EVENT, sync)
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, sync)
  }, [track.id])

  const toggle = useCallback(async () => {
    if (!available) return
    setBusy(true)
    try {
      if (isTrackSavedIndividually(track.id)) {
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
  }, [track, available])

  return { supported, available, desktopOnly, saved, busy, toggle }
}
