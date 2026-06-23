import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SpeakerWaveIcon } from '@heroicons/react/24/solid'
import { usePlayerStore } from '@/stores/playerStore'
import { adService } from '@/services/adService'
import { useTranslation } from '@/i18n/useTranslation'

/**
 * Free-tier ad break. For now this is a silent placeholder: when an ad is active
 * we hold playback for a fixed 5 seconds (no audio is played), show the banner +
 * countdown, then release the held track via endAd(). The transport stays locked
 * in the store until the countdown finishes so the break is non-skippable.
 */
const AD_SECONDS = 5

export function PromoPlayer() {
  const { t } = useTranslation()
  const ad = usePlayerStore((s) => s.currentAd)
  const endAd = usePlayerStore((s) => s.endAd)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!ad) {
      setRemaining(null)
      return
    }
    setRemaining(AD_SECONDS)
    adService.recordImpression(ad.id).catch(() => { })
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000
      setRemaining(Math.max(0, Math.ceil(AD_SECONDS - elapsed)))
      if (elapsed >= AD_SECONDS) {
        window.clearInterval(interval)
        endAd()
      }
    }, 250)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad])

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
    </div>
  )
}
