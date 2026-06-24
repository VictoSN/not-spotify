import { useState } from 'react'
import type { Track } from '@/types/track'
import { useDragStore } from '@/stores/dragStore'
import { TRACK_DND_MIME } from '@/utils/trackDnd'

/**
 * Turns an element into a drop target for dragged tracks.
 *
 * Returns `isOver` (true while a valid track drag hovers the element, for the green
 * highlight) and `dropProps` to spread onto the element. When `canDrop` is false the
 * handlers no-op so the element ignores track drags entirely.
 */
export function useTrackDrop(canDrop: boolean, onDropTrack: (track: Track) => void) {
  const [isOver, setIsOver] = useState(false)

  const isTrackDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(TRACK_DND_MIME)

  const onDragOver = (e: React.DragEvent) => {
    if (!canDrop || !isTrackDrag(e)) return
    e.preventDefault() // required to allow a drop
    e.dataTransfer.dropEffect = 'copy'
    if (!isOver) setIsOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    // Ignore leave events fired when moving onto a child element.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    if (!canDrop || !isTrackDrag(e)) return
    e.preventDefault()
    setIsOver(false)
    const track = useDragStore.getState().draggedTrack
    if (track) onDropTrack(track)
  }

  return { isOver, dropProps: { onDragOver, onDragLeave, onDrop } }
}
