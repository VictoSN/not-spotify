import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SpeakerWaveIcon } from '@heroicons/react/24/solid'
import { usePlayerStore } from '@/stores/playerStore'
import { adService } from '@/services/adService'
import { useTranslation } from '@/i18n/useTranslation'

/**
 * Plays a free-tier audio ad through its own element so the two-deck engine is
 * untouched. Mounted just above the player bar; renders nothing unless an ad is
 * active. The ad is non-skippable — transport stays locked in the store until
 * playback ends (or the audio errors / autoplay is blocked, which we treat as
 * "ad over" so the listener is never stuck).
 */
export function PromoPlayer() {
  const { t } = useTranslation()
  const ad = usePlayerStore((s) => s.currentAd)
  const endAd = usePlayerStore((s) => s.endAd)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const impressionSent = useRef(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    impressionSent.current = false
    setRemaining(null)
    const el = audioRef.current
    if (!ad || !el) return
    el.volume = isMuted ? 0 : volume
    el.currentTime = 0
    el.play().catch(() => endAd()) // autoplay blocked → don't strand the listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  if (!ad) return null

  return (
    <div className="shrink-0 border-t border-elevated/20 bg-accent/15">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <SpeakerWaveIcon className="h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              {t('ad.label')}
            </span>
            <span className="truncate text-sm font-semibold text-primary">{ad.title}</span>
            {remaining != null && <span className="shrink-0 text-xs text-secondary">{remaining}s</span>}
          </div>
          <div className="truncate text-xs text-secondary">{ad.advertiser}</div>
        </div>
        <Link
          to="/premium"
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-page transition-transform hover:scale-105"
        >
          {t('ad.goAdFree')}
        </Link>
      </div>
      <audio
        ref={audioRef}
        src={ad.audioUrl}
        onPlay={() => {
          if (!impressionSent.current) {
            impressionSent.current = true
            adService.recordImpression(ad.id).catch(() => { })
          }
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : ad.durationMs / 1000
          setRemaining(Math.max(0, Math.ceil(total - el.currentTime)))
        }}
        onEnded={endAd}
        onError={endAd}
      />
    </div>
  )
}
