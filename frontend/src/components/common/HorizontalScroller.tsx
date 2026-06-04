import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

interface HorizontalScrollerProps {
  children: ReactNode
}

export function HorizontalScroller({ children }: HorizontalScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < maxScroll - 1)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    // Children resizing (lazy-loaded images) can also change scrollWidth.
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, children])

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const arrowsVisible = canScrollLeft || canScrollRight

  return (
    <div className="group/scroller relative">
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide scroll-smooth"
      >
        {children}
      </div>

      {arrowsVisible && (
        <>
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/70 backdrop-blur text-white shadow-xl flex items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-200 hover:bg-black/90 hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/70 backdrop-blur text-white shadow-xl flex items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-200 hover:bg-black/90 hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  )
}
