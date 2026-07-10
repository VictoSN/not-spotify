import { useEffect, useRef, useState } from 'react'

interface OverlayScrollbarProps {
  /** The scrollable element whose scroll position this thumb mirrors. */
  scrollRef: React.RefObject<HTMLDivElement | null>
  /**
   * Optional nested scroll source. The thumb still uses the main scrollRef's
   * full-height rail, but mirrors and controls this element's scroll range.
   */
  scrollTarget?: HTMLDivElement | null
  /** Attach the thumb to the panel edge instead of using the default 2px inset. */
  flushRight?: boolean
}

/**
 * Spotify-style overlay scrollbar.
 *
 * A native scrollbar reserves a gutter column, so content is clipped at the
 * gutter's edge and can never render *underneath* the thumb. To match Spotify —
 * where cards/rows run full-width and the floating thumb sits on top of their
 * right edge — we hide the native bar on `scrollRef` (via `scrollbar-hide`) and
 * paint this thumb absolutely over the content instead. Wheel/keyboard scrolling
 * still works natively; dragging the thumb proxies back to `scrollTop`.
 *
 * Mouse grabs the thumb instantly. Touch uses Spotify-mobile's press-and-HOLD:
 * the finger must rest on the thumb for {@link TOUCH_HOLD_MS} before the drag
 * engages (the thumb widens + brightens to confirm); a quick tap or swipe lets
 * go without hijacking the gesture.
 *
 * Mount inside a `position: relative` ancestor that shares the scroll viewport's
 * box (e.g. the `<main>` card). Renders nothing when the content doesn't overflow.
 */
/** How long a finger must rest on the thumb before the drag engages (touch only). */
const TOUCH_HOLD_MS = 140
/** Finger drift beyond this while holding cancels the grab (it was a swipe). */
const TOUCH_HOLD_SLOP_PX = 18
const DESKTOP_MIN_THUMB_HEIGHT = 40
const MOBILE_MIN_THUMB_HEIGHT = 26

function getMinimumThumbHeight() {
  if (typeof window.matchMedia !== 'function') return DESKTOP_MIN_THUMB_HEIGHT
  const mobilePointer = window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(max-width: 768px)').matches
  return mobilePointer ? MOBILE_MIN_THUMB_HEIGHT : DESKTOP_MIN_THUMB_HEIGHT
}

function clearPageSelection() {
  window.getSelection()?.removeAllRanges()
}

function preventPageSelection(event: Event) {
  event.preventDefault()
  clearPageSelection()
}

/**
 * Toggle page-wide selection while pressing/dragging the thumb. On iOS the
 * hold gesture IS a long-press, which natively starts text selection + the
 * loupe over whatever content sits near the finger — so selection must be
 * killed the moment the finger lands (not once the hold engages), and any
 * selection iOS already started gets cleared.
 */
function setPageSelectionDisabled(disabled: boolean) {
  const style = document.body.style as CSSStyleDeclaration & {
    webkitUserSelect?: string
    webkitTouchCallout?: string
  }
  style.userSelect = disabled ? 'none' : ''
  style.webkitUserSelect = disabled ? 'none' : ''
  style.webkitTouchCallout = disabled ? 'none' : ''
  document.documentElement.classList.toggle('overlay-scrollbar-grabbing', disabled)
  if (disabled) {
    clearPageSelection()
    document.addEventListener('selectstart', preventPageSelection, true)
    document.addEventListener('selectionchange', clearPageSelection)
  } else {
    document.removeEventListener('selectstart', preventPageSelection, true)
    document.removeEventListener('selectionchange', clearPageSelection)
  }
}

export function OverlayScrollbar({ scrollRef, scrollTarget = null, flushRight = false }: OverlayScrollbarProps) {
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null)
  // Visible (and brighter) while hovering the scroll area, scrolling, or dragging.
  const [active, setActive] = useState(false)
  // A touch drag is engaged (post-hold) — the thumb widens so the grab reads.
  const [touchDragging, setTouchDragging] = useState(false)
  const dragRef = useRef<{ pointerId: number; startY: number; startScroll: number } | null>(null)
  // Touch press waiting out the hold delay before it becomes a drag.
  const pendingTouchRef = useRef<{ pointerId: number; startY: number; lastY: number; timer: number } | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const el = scrollTarget ?? scrollRef.current
    const rail = scrollRef.current
    if (!el || !rail) return

    const recompute = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight <= clientHeight + 1) {
        setThumb(null)
        return
      }
      const railHeight = rail.clientHeight
      const height = Math.min(
        railHeight,
        Math.max(getMinimumThumbHeight(), (clientHeight / scrollHeight) * railHeight),
      )
      const maxTop = railHeight - height
      const maxScroll = scrollHeight - clientHeight
      const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0
      setThumb({ height, top })
    }

    const flash = () => {
      setActive(true)
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => {
        if (!dragRef.current && !pendingTouchRef.current) setActive(false)
      }, 1000)
    }
    const onScroll = () => {
      recompute()
      flash()
    }
    const onEnter = () => setActive(true)
    const onLeave = () => {
      if (!dragRef.current) setActive(false)
    }

    recompute()
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    if (rail !== el) ro.observe(rail)
    const observeChildren = () => {
      Array.from(el.children).forEach((child) => ro.observe(child))
    }
    observeChildren()
    const mo = new MutationObserver(() => {
      observeChildren()
      recompute()
    })
    mo.observe(el, { childList: true, subtree: true, characterData: true })

    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      ro.disconnect()
      mo.disconnect()
      window.clearTimeout(hideTimer.current)
    }
  }, [scrollRef, scrollTarget])

  // Drag the thumb → scroll the content (mapped from thumb travel to scroll range).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Touch press still waiting out the hold: track the finger, and if it
      // drifts too far this was a swipe — release without ever grabbing.
      const pending = pendingTouchRef.current
      if (pending && e.pointerId === pending.pointerId) {
        pending.lastY = e.clientY
        if (Math.abs(e.clientY - pending.startY) > TOUCH_HOLD_SLOP_PX) {
          window.clearTimeout(pending.timer)
          pendingTouchRef.current = null
          setActive(false)
          setPageSelectionDisabled(false)
        }
        return
      }
      const el = scrollTarget ?? scrollRef.current
      const rail = scrollRef.current
      const drag = dragRef.current
      if (!el || !rail || !drag || e.pointerId !== drag.pointerId) return
      const { scrollHeight, clientHeight } = el
      const railHeight = rail.clientHeight
      const height = Math.min(
        railHeight,
        Math.max(getMinimumThumbHeight(), (clientHeight / scrollHeight) * railHeight),
      )
      const maxTop = railHeight - height
      const maxScroll = scrollHeight - clientHeight
      const ratio = maxTop > 0 ? (e.clientY - drag.startY) / maxTop : 0
      el.scrollTop = Math.min(maxScroll, Math.max(0, drag.startScroll + ratio * maxScroll))
    }
    const onUp = (e: PointerEvent) => {
      const pending = pendingTouchRef.current
      const pendingMatches = Boolean(pending && e.pointerId === pending.pointerId)
      const dragMatches = Boolean(dragRef.current && e.pointerId === dragRef.current.pointerId)
      if (!pendingMatches && !dragMatches) return
      if (pendingMatches && pending) {
        window.clearTimeout(pending.timer)
        pendingTouchRef.current = null
        setActive(false)
      }
      setPageSelectionDisabled(false)
      if (!dragMatches) return
      dragRef.current = null
      setTouchDragging(false)
      setActive(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (pendingTouchRef.current) window.clearTimeout(pendingTouchRef.current.timer)
      pendingTouchRef.current = null
      setPageSelectionDisabled(false)
    }
  }, [scrollRef, scrollTarget])

  if (!thumb) return null

  return (
    <>
      {flushRight && (
        <div
          aria-hidden
          data-overlay-scrollbar-fade
          className="pointer-events-none absolute right-0 top-0 z-[39] h-full w-6"
          style={{ background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.18))' }}
        />
      )}
    {/* Full-height transparent rail pinned to the far-right edge. */}
    <div
      aria-hidden
      data-overlay-scrollbar-track
      className={`pointer-events-none absolute right-0 top-0 z-40 h-full bg-transparent ${
        flushRight ? 'w-[10px]' : 'w-4'
      }`}
    >
      <div
        data-overlay-scrollbar-thumb
        onPointerDown={(e) => {
          const el = scrollTarget ?? scrollRef.current
          if (!el) return
          e.preventDefault()
          setPageSelectionDisabled(true)
          setActive(true)
          if (e.pointerType === 'touch') {
            // Spotify-mobile style: the press must be HELD briefly before the
            // thumb is grabbed — then it widens and dragging fast-scrolls. A
            // quick tap or swipe releases without hijacking anything.
            const pointerId = e.pointerId
            const thumbElement = e.currentTarget
            const timer = window.setTimeout(() => {
              const pending = pendingTouchRef.current
              if (!pending || pending.pointerId !== pointerId) return
              try {
                thumbElement.setPointerCapture?.(pointerId)
              } catch {
                /* window-level listeners still track a stale/synthetic pointer id */
              }
              pendingTouchRef.current = null
              dragRef.current = { pointerId, startY: pending.lastY, startScroll: el.scrollTop }
              setTouchDragging(true)
              if ('vibrate' in navigator) navigator.vibrate(10) // grab confirmation where supported
            }, TOUCH_HOLD_MS)
            pendingTouchRef.current = { pointerId, startY: e.clientY, lastY: e.clientY, timer }
          } else {
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId)
            } catch {
              /* window-level listeners still track a stale/synthetic pointer id */
            }
            dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startScroll: el.scrollTop }
          }
        }}
        style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
        // ~12px thick, near-square (2px radius), semi-transparent gray — visible at
        // rest, brighter while scrolling/hovering, brightest when grabbed. A held
        // touch grab widens it so the engaged state is unmistakable under a finger.
        className="group pointer-events-auto absolute right-0 w-6 touch-none select-none border-0 outline-none [-webkit-touch-callout:none]"
      >
        <span
          data-overlay-scrollbar-thumb-visual
          className={`absolute right-[2px] h-full rounded-[2px] transition-[background-color,width] duration-150 group-hover:bg-[rgba(190,190,190,0.95)] ${
            touchDragging ? 'w-[16px]' : flushRight ? 'w-[10px]' : 'w-[12px]'
          } ${
            touchDragging
              ? 'bg-[rgba(190,190,190,0.95)]'
              : active ? 'bg-[rgba(150,150,150,0.8)]' : 'bg-[rgba(150,150,150,0.45)]'
          }`}
        />
      </div>
    </div>
    </>
  )
}
