import { useEffect, useRef, useState } from 'react'

interface OverlayScrollbarProps {
  /** The scrollable element whose scroll position this thumb mirrors. */
  scrollRef: React.RefObject<HTMLDivElement | null>
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
 * Mount inside a `position: relative` ancestor that shares the scroll viewport's
 * box (e.g. the `<main>` card). Renders nothing when the content doesn't overflow.
 */
export function OverlayScrollbar({ scrollRef, flushRight = false }: OverlayScrollbarProps) {
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null)
  // Visible (and brighter) while hovering the scroll area, scrolling, or dragging.
  const [active, setActive] = useState(false)
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const recompute = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight <= clientHeight + 1) {
        setThumb(null)
        return
      }
      const height = Math.max(40, (clientHeight / scrollHeight) * clientHeight)
      const maxTop = clientHeight - height
      const maxScroll = scrollHeight - clientHeight
      const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0
      setThumb({ height, top })
    }

    const flash = () => {
      setActive(true)
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => {
        if (!dragRef.current) setActive(false)
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
    if (el.firstElementChild) ro.observe(el.firstElementChild)

    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      ro.disconnect()
      window.clearTimeout(hideTimer.current)
    }
  }, [scrollRef])

  // Drag the thumb → scroll the content (mapped from thumb travel to scroll range).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current
      const drag = dragRef.current
      if (!el || !drag) return
      const { scrollHeight, clientHeight } = el
      const height = Math.max(40, (clientHeight / scrollHeight) * clientHeight)
      const maxTop = clientHeight - height
      const maxScroll = scrollHeight - clientHeight
      const ratio = maxTop > 0 ? (e.clientY - drag.startY) / maxTop : 0
      el.scrollTop = Math.min(maxScroll, Math.max(0, drag.startScroll + ratio * maxScroll))
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setActive(false)
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [scrollRef])

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
        onMouseDown={(e) => {
          const el = scrollRef.current
          if (!el) return
          e.preventDefault()
          dragRef.current = { startY: e.clientY, startScroll: el.scrollTop }
          setActive(true)
          document.body.style.userSelect = 'none'
        }}
        style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
        // ~12px thick, near-square (2px radius), semi-transparent gray — visible at
        // rest, brighter while scrolling/hovering, brightest when grabbed.
        className={`pointer-events-auto absolute rounded-[2px] border-0 outline-none shadow-none transition-[background-color] duration-200 hover:bg-[rgba(190,190,190,0.95)] ${
          flushRight ? 'right-0 w-[10px]' : 'right-[2px] w-[12px]'
        } ${
          active ? 'bg-[rgba(150,150,150,0.8)]' : 'bg-[rgba(150,150,150,0.45)]'
        }`}
      />
    </div>
    </>
  )
}
