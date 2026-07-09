import { useCallback, useEffect, useState } from 'react'
import type { Track } from '@/types/track'
import {
  OFFLINE_CHANGE_EVENT,
  collectionKey,
  isCollectionSaved,
  isOfflineSupported,
  removeCollectionOffline,
  saveCollectionOffline,
  type CollectionMeta,
} from '@/services/offlineAudio'
import { notify } from '@/utils/toast'
import { isDesktop } from '@/utils/platform'

/**
 * Download-state + toggle for a whole album/playlist. Mirrors {@link useOfflineTrack}
 * but batch-saves every track under one collection key, exposing per-track
 * progress. `getTracks` is called lazily (only when downloading) so a card menu
 * can fetch the track list on demand.
 *
 * Desktop-only, same as track downloads: in the browser `available` is false and
 * `desktopOnly` is true so the UI can render a grayed-out "Desktop" affordance.
 */
export function useOfflineCollection(
  meta: CollectionMeta,
  getTracks: () => Promise<Track[]> | Track[],
) {
  const key = collectionKey(meta.kind, meta.id)
  const desktopOnly = !isDesktop()
  const available = isOfflineSupported() && !desktopOnly
  const [saved, setSaved] = useState(() => isCollectionSaved(key))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    const sync = () => setSaved(isCollectionSaved(key))
    sync()
    window.addEventListener(OFFLINE_CHANGE_EVENT, sync)
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, sync)
  }, [key])

  const toggle = useCallback(async () => {
    if (!available || busy) return
    setBusy(true)
    try {
      if (isCollectionSaved(key)) {
        await removeCollectionOffline(key)
        notify.success(`Removed “${meta.name}” download`)
      } else {
        const tracks = await getTracks()
        if (!tracks || tracks.length === 0) {
          notify.info('No tracks available to download yet')
          return
        }
        notify.info(`Downloading “${meta.name}” (${tracks.length} songs)…`)
        setProgress({ done: 0, total: tracks.length })
        const { saved: n, failed } = await saveCollectionOffline(meta, tracks, (done, total) =>
          setProgress({ done, total }),
        )
        if (n === 0) notify.error('Could not download — check your connection.')
        else if (failed > 0) notify.success(`Downloaded ${n} of ${n + failed} songs`)
        else notify.success(`Downloaded “${meta.name}” for offline`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not update download.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [available, busy, key, meta, getTracks])

  return { supported: available, available, desktopOnly, saved, busy, progress, toggle }
}
