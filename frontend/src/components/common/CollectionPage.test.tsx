import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CollectionPageSkeleton } from './CollectionPage'

describe('CollectionPageSkeleton', () => {
  it('renders the shared square-card loading grid', () => {
    render(<CollectionPageSkeleton label="Loading collection" count={8} />)

    const skeleton = screen.getByRole('status', { name: 'Loading collection' })
    expect(skeleton).toHaveClass('animate-pulse', 'min-h-[calc(100vh-6rem)]')
    expect(skeleton.querySelectorAll('.aspect-square')).toHaveLength(8)
  })

  it('supports wide artwork for music video pages', () => {
    render(<CollectionPageSkeleton label="Loading videos" variant="video" count={6} />)

    expect(screen.getByRole('status', { name: 'Loading videos' }).querySelectorAll('.aspect-video')).toHaveLength(6)
  })
})
