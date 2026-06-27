import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowTopRightOnSquareIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid'
import { usePlayerStore } from '@/stores/playerStore'
import { adService } from '@/services/adService'
import { useTranslation } from '@/i18n/useTranslation'

/**
 * Free-tier ad break. Plays the ad's own audio through a dedicated element (so it
 * never touches the two-deck track engine) and holds the transport — which the
 * store locks while `currentAd` is set — until the audio finishes, then releases
 * the held track via endAd(). Non-skippable. If the audio can't play (missing URL
 * or autoplay block), it falls back to a duration-based timer so the break still
 * ends instead of getting stuck.
 */
const FALLBACK_SECONDS = 5

export function PromoPlayer() {
  const { t } = useTranslation()
  const ad = usePlayerStore((s) => s.currentAd)
  const endAd = usePlayerStore((s) => s.endAd)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!ad) {
      setRemaining(null)
      return
    }

    adService.recordImpression(ad.id).catch(() => {})

    let done = false
    let fallbackTimer: number | null = null
    const finish = () => {
      if (done) return
      done = true
      if (fallbackTimer != null) window.clearInterval(fallbackTimer)
      endAd()
    }

    // Time-based fallback: ends the break even if the audio never plays.
    const startFallback = (totalSeconds: number) => {
      if (done) return
      if (fallbackTimer != null) window.clearInterval(fallbackTimer)
      const startedAt = Date.now()
      setRemaining(Math.ceil(totalSeconds))
      fallbackTimer = window.setInterval(() => {
        if (done) return
        const left = totalSeconds - (Date.now() - startedAt) / 1000
        setRemaining(Math.max(0, Math.ceil(left)))
        if (left <= 0) finish()
      }, 250)
    }

    if (!ad.audioUrl) {
      startFallback(ad.durationMs > 0 ? ad.durationMs / 1000 : FALLBACK_SECONDS)
      return () => {
        done = true
        if (fallbackTimer != null) window.clearInterval(fallbackTimer)
      }
    }

    const audio = new Audio(ad.audioUrl)
    audio.preload = 'auto'
    audio.volume = isMuted ? 0 : volume
    audioRef.current = audio
    if (ad.durationMs > 0) setRemaining(Math.ceil(ad.durationMs / 1000))

    const onTime = () => {
      const total = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : ad.durationMs / 1000
      setRemaining(Math.max(0, Math.ceil(total - audio.currentTime)))
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onTime)
    audio.addEventListener('ended', finish)
    // If playback errors out mid-break, don't strand the listener.
    audio.addEventListener('error', () =>
      startFallback(ad.durationMs > 0 ? ad.durationMs / 1000 : FALLBACK_SECONDS))

    audio.play().catch(() => {
      // Autoplay blocked or unsupported source — fall back to the timer.
      startFallback(ad.durationMs > 0 ? ad.durationMs / 1000 : FALLBACK_SECONDS)
    })

    return () => {
      done = true
      if (fallbackTimer != null) window.clearInterval(fallbackTimer)
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onTime)
      audio.removeEventListener('ended', finish)
      audio.src = ''
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad])

  // Keep the ad's volume in sync with the player's volume/mute while it plays.
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
            {ad.clickUrl ? (
              <a
                href={ad.clickUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="group flex min-w-0 items-center gap-1 text-sm font-semibold text-primary hover:text-accent hover:underline"
              >
                <span className="truncate">{ad.title}</span>
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
              </a>
            ) : (
              <span className="truncate text-sm font-semibold text-primary">{ad.title}</span>
            )}
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
    </div>
  )
}
