import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LyricsView } from './LyricsView'

const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
let measuredScrollHeight = 600

describe('LyricsView track-page layout', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => measuredScrollHeight,
    })
  })

  afterAll(() => {
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
    } else {
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
    }
  })

  it('uses the compact reference typography and expands long lyrics', () => {
    measuredScrollHeight = 600
    render(
      <LyricsView
        lyrics={Array.from({ length: 24 }, (_, index) => `Lyric line ${index + 1}`).join('\n')}
        collapsible
      />,
    )

    const lyrics = screen.getByTestId('track-lyrics-text')
    expect(lyrics).toHaveClass('text-base', 'font-semibold', 'leading-[1.4]', 'text-secondary', 'overflow-hidden')
    expect(lyrics).toHaveStyle({ maxHeight: '352px' })

    const toggle = screen.getByRole('button', { name: '...Show more' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
    expect(lyrics).not.toHaveClass('overflow-hidden')
    expect(lyrics).not.toHaveStyle({ maxHeight: '352px' })
  })
})
