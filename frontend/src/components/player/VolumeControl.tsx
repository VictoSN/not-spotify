import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline'
import { Slider } from '@/components/ui/Slider'
import { usePlayerStore } from '@/stores/playerStore'

export function VolumeControl() {
  const { volume, isMuted, setVolume, toggleMute } = usePlayerStore()

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggleMute} className="text-secondary hover:text-primary transition-colors" aria-label={isMuted ? 'Unmute' : 'Mute'}>
        {isMuted || volume === 0 ? (
          <SpeakerXMarkIcon className="w-4 h-4" />
        ) : (
          <SpeakerWaveIcon className="w-4 h-4" />
        )}
      </button>
      <Slider
        value={isMuted ? 0 : volume * 100}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => setVolume(v / 100)}
        className="w-24"
        aria-label="Volume"
      />
    </div>
  )
}
