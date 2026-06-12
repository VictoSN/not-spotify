import { useEffect, useState } from 'react'
import { trackService } from '@/services/trackService'

export interface LyricsData {
  trackId: string
  lyrics: string | null
  syncedLyrics: string | null
}

/** Fetches lyrics for a track; result is tagged with the trackId so stale data never shows. */
export function useLyrics(trackId: string | undefined): LyricsData | null {
  const [data, setData] = useState<LyricsData | null>(null)

  useEffect(() => {
    if (!trackId) return
    let cancelled = false
    trackService
      .getLyrics(trackId)
      .then((res) => {
        if (!cancelled) setData({ trackId, lyrics: res.lyrics, syncedLyrics: res.syncedLyrics })
      })
      .catch(() => {
        if (!cancelled) setData({ trackId, lyrics: null, syncedLyrics: null })
      })
    return () => {
      cancelled = true
    }
  }, [trackId])

  if (!data || data.trackId !== trackId) return null
  return data
}
