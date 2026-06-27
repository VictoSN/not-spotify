import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetailHero } from './DetailHero'

/**
 * The Album and Track detail headers both render through DetailHero, so the
 * structure they share — cover sizing, eyebrow, title, and action-bar spacing —
 * is locked in one place and can't drift apart again (bug #10). These assertions
 * pin the canonical classes both pages inherit.
 */
function renderHero() {
  return render(
    <DetailHero
      heroColor="hsl(210 50% 40%)"
      coverUrl="/cover.jpg"
      coverAlt="Cover"
      eyebrow="SONG"
      title="Title"
      meta={<div data-testid="meta">meta row</div>}
      actions={<button data-testid="action">Play</button>}
    />,
  )
}

describe('DetailHero', () => {
  it('renders the cover with the shared responsive sizing classes', () => {
    const { getByAltText } = renderHero()
    const cover = getByAltText('Cover')
    expect(cover).toHaveAttribute('src', '/cover.jpg')
    // Same cover dimensions on Album + Track so they line up identically.
    for (const cls of ['w-36', 'h-36', 'sm:w-44', 'md:w-52', 'rounded-md', 'object-cover']) {
      expect(cover.className).toContain(cls)
    }
  })

  it('renders the eyebrow with the shared muted-uppercase styling', () => {
    const { getByText } = renderHero()
    const eyebrow = getByText('SONG')
    for (const cls of ['text-xs', 'font-semibold', 'uppercase', 'tracking-wider', 'text-secondary']) {
      expect(eyebrow.className).toContain(cls)
    }
  })

  it('renders the title with the shared hero heading styling', () => {
    const { getByRole } = renderHero()
    const title = getByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Title')
    for (const cls of ['text-3xl', 'sm:text-4xl', 'md:text-5xl', 'font-black', 'text-primary']) {
      expect(title.className).toContain(cls)
    }
  })

  it('renders the meta and actions slots inside the gradient wrapper', () => {
    const { getByTestId } = renderHero()
    const action = getByTestId('action')
    expect(getByTestId('meta')).toBeInTheDocument()
    expect(action).toBeInTheDocument()
    // Action bar wrapper shares spacing/wrap so the toolbars line up.
    const actionBar = action.parentElement!
    for (const cls of ['flex', 'items-center', 'gap-3', 'flex-wrap']) {
      expect(actionBar.className).toContain(cls)
    }
  })

  it('paints the artwork hue gradient as the hero background', () => {
    const { getByAltText } = renderHero()
    // The gradient wrapper is the grandparent of the cover image.
    const wrapper = getByAltText('Cover').parentElement!.parentElement as HTMLElement
    expect(wrapper.style.background).toContain('linear-gradient')
  })
})
