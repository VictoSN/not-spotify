import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline'
import { Slider } from '@/components/ui/Slider'
import { usePlayerStore } from '@/stores/playerStore'
import { useTranslation } from '@/i18n/useTranslation'

export function VolumeControl() {
  const { t } = useTranslation()
  const { volume, isMuted, setVolume, toggleMute } = usePlayerStore()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className="spotify-tooltip-anchor relative text-secondary transition-all hover:scale-110 hover:text-primary active:scale-90"
        aria-label={isMuted ? t('player.unmute') : t('player.mute')}
      >
        {isMuted || volume === 0 ? (
          <SpeakerXMarkIcon className="w-4 h-4" />
        ) : (
          <SpeakerWaveIcon className="w-4 h-4" />
        )}
        <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">
          {isMuted ? t('player.unmute') : t('player.mute')}
        </span>
      </button>
      <Slider
        value={isMuted ? 0 : volume * 100}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => setVolume(v / 100)}
        className="w-24"
        aria-label={t('player.volume')}
      />
    </div>
  )
}
