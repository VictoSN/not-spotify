import { useState } from 'react'
import { Slider } from '@/components/ui/Slider'
import { usePlayerStore } from '@/stores/playerStore'
import { formatSeconds } from '@/utils/formatTime'

export function ProgressBar() {
  const { playbackMode, currentTime, duration, videoCurrentTime, videoDuration, seek } = usePlayerStore()
  const [dragging, setDragging] = useState(false)
  const [dragValue, setDragValue] = useState(0)

  const activeTime = playbackMode === 'video' ? videoCurrentTime : currentTime
  const activeDuration = playbackMode === 'video' ? videoDuration : duration
  const display = dragging ? dragValue : activeTime
  const max = activeDuration > 0 ? activeDuration : 1

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="min-w-[40px] text-right text-xs tabular-nums text-secondary">{formatSeconds(display)}</span>
      <Slider
        value={display}
        min={0}
        max={max}
        step={0.5}
        onValueChange={(v) => { setDragging(true); setDragValue(v) }}
        onValueCommit={(v) => { seek(v); setDragging(false) }}
        className="flex-1"
        aria-label="Playback progress"
      />
      <span className="min-w-[40px] text-left text-xs tabular-nums text-secondary">{formatSeconds(activeDuration)}</span>
    </div>
  )
}
