import React, { useLayoutEffect, useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OverlayScrollbar } from './OverlayScrollbar'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  matches: query === '(pointer: coarse)',
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})))

function setMetric(element: HTMLElement, name: 'clientHeight' | 'scrollHeight', value: number) {
  Object.defineProperty(element, name, { configurable: true, value })
}

function ScrollbarHarness() {
  const railRef = useRef<HTMLDivElement | null>(null)
  const sourceRef = useRef<HTMLDivElement | null>(null)
  const [source, setSource] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const rail = railRef.current
    const nestedSource = sourceRef.current
    if (!rail || !nestedSource) return
    setMetric(rail, 'clientHeight', 600)
    setMetric(nestedSource, 'clientHeight', 300)
    setMetric(nestedSource, 'scrollHeight', 1200)
    setSource(nestedSource)
  }, [])

  return (
    <div ref={railRef}>
      <div ref={sourceRef} data-testid="nested-scroll-source">
        <div>Chat messages</div>
      </div>
      <OverlayScrollbar scrollRef={railRef} scrollTarget={source} />
    </div>
  )
}

describe('OverlayScrollbar nested mobile source', () => {
  it('uses the main rail size while mirroring and touch-dragging the chat source', async () => {
    render(<ScrollbarHarness />)

    const source = screen.getByTestId('nested-scroll-source')
    const thumb = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-overlay-scrollbar-thumb]')
      expect(element).not.toBeNull()
      return element!
    })

    // 300px chat viewport / 1200px content over the 600px main page rail.
    expect(thumb.style.height).toBe('150px')

    source.scrollTop = 450
    fireEvent.scroll(source)
    await waitFor(() => expect(thumb.style.transform).toBe('translateY(225px)'))

    fireEvent.pointerDown(thumb, { pointerId: 7, clientY: 225 })
    expect(document.documentElement).toHaveClass('overlay-scrollbar-grabbing')
    expect(document.body.style.userSelect).toBe('none')
    fireEvent.pointerMove(window, { pointerId: 7, clientY: 450 })
    expect(source.scrollTop).toBe(900)
    fireEvent.pointerUp(window, { pointerId: 7, clientY: 450 })
    expect(document.documentElement).not.toHaveClass('overlay-scrollbar-grabbing')
    expect(document.body.style.userSelect).toBe('')

    // Coarse-pointer devices use a smaller minimum than desktop, preserving
    // useful travel and position accuracy for very long conversations.
    setMetric(source, 'scrollHeight', 30_000)
    fireEvent.scroll(source)
    await waitFor(() => expect(thumb.style.height).toBe('26px'))

    fireEvent.pointerDown(thumb, { pointerId: 8, pointerType: 'touch', clientY: 40 })
    expect(document.documentElement).toHaveClass('overlay-scrollbar-grabbing')
    fireEvent.pointerUp(window, { pointerId: 8, pointerType: 'touch', clientY: 40 })
    expect(document.documentElement).not.toHaveClass('overlay-scrollbar-grabbing')
  })
})
