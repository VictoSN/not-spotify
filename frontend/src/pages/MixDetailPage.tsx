import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PlayIcon, PauseIcon, ClockIcon } from '@heroicons/react/24/solid'
import type { DailyMix } from '@/services/trackService'
import { trackService } from '@/services/trackService'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslation } from '@/i18n/useTranslation'
import { TrackRow } from '@/components/cards/TrackRow'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { heroGradient } from '@/hooks/useDominantColor'
import { formatMs } from '@/utils/formatTime'

export function MixDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [mix, setMix] = useState<DailyMix | null>(null)
  const [loading, setLoading] = useState(true)
  useDocumentTitle(mix?.title ?? null)
  const isMobile = useIsMobile()
  const startContext = usePlayContextGate()
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const { isActiveContext, isPlayingContext } = usePlaybackContext(id ? { type: 'mix', id } : null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    trackService
      .getDailyMix(id)
      .then((m) => active && setMix(m))
      .catch(() => active && setMix(null))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  if (!mix) return <div className="p-8 text-secondary">Mix not found.</div>

  const accent = mix.color ?? '#1db954'
  const covers: string[] = []
  for (const tk of mix.tracks) {
    const url = tk.album?.coverUrl
    if (url && !covers.includes(url)) covers.push(url)
    if (covers.length === 4) break
  }
  const totalDuration = mix.tracks.reduce((acc, t) => acc + t.durationMs, 0)

  return (
    <div>
      <div style={{ background: heroGradient(accent) }}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 p-4 sm:p-6 pb-4">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-md shadow-2xl flex-shrink-0 overflow-hidden self-center sm:self-auto">
            {covers.length >= 4 ? (
              <div className="grid h-full w-full grid-cols-2 grid-rows-2">
                {covers.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-full w-full object-cover" />
                ))}
              </div>
            ) : covers.length >= 1 ? (
              <img src={covers[0]} alt={mix.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ backgroundColor: accent }} />
            )}
            <div
              className="absolute inset-x-0 bottom-0 px-3 py-2"
              style={{ background: `linear-gradient(to top, ${accent}f2, ${accent}00)` }}
            >
              <p className="text-xs font-black uppercase tracking-wide text-white drop-shadow">{mix.subtitle}</p>
            </div>
          </div>
          <div className="min-w-0 pb-2">
            <p className="text-xs uppercase tracking-wider text-secondary mb-1">{mix.subtitle}</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-2 break-words">{mix.title}</h1>
            <p className="text-sm text-secondary">
              {t('detail.songsCount', { count: mix.tracks.length, dur: formatMs(totalDuration) })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 flex-wrap">
          <Button
            onClick={() => {
              if (!mix.tracks.length) return
              if (isActiveContext) togglePlayPause()
              else startContext({ type: 'mix', id: mix.id }, mix.tracks)
            }}
            size="lg"
            className="gap-2"
          >
            {isPlayingContext ? (
              <><PauseIcon className="w-5 h-5" /> {t('player.pause')}</>
            ) : (
              <><PlayIcon className="w-5 h-5" /> {t('common.play')}</>
            )}
          </Button>
        </div>
      </div>

      <div className="px-4">
        <div
          className="grid items-center gap-4 px-4 py-2 border-b border-elevated/30 mb-2"
          style={{ gridTemplateColumns: isMobile ? '16px 1fr var(--track-actions-width)' : '16px 6fr 3fr var(--track-actions-width)' }}
        >
          <span className="text-xs text-secondary">#</span>
          <span className="text-xs text-secondary uppercase tracking-wider">{t('detail.colTitle')}</span>
          <span className="text-xs text-secondary uppercase tracking-wider hidden md:block">{t('detail.colPlays')}</span>
          <div className="grid grid-cols-[32px_50px_32px] sm:grid-cols-[80px_32px_50px_32px] items-center gap-1.5 sm:gap-2 justify-end w-[114px] sm:w-[194px] ml-auto">
            <span className="hidden sm:block" />
            <span />
            <span className="flex justify-end pr-1">
              <ClockIcon className="w-4 h-4 text-secondary" />
            </span>
            <span />
          </div>
        </div>
        {mix.tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} queue={mix.tracks} showPlayCount context={{ type: 'mix', id: mix.id }} />
        ))}
      </div>
    </div>
  )
}
