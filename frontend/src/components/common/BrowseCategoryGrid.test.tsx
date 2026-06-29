import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BrowseCategoryGrid } from './BrowseCategoryGrid'

function renderGrid() {
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <Routes>
        <Route path="/search" element={<BrowseCategoryGrid genres={[]} />} />
        <Route path="/genres/:slug" element={<div>Genre destination</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BrowseCategoryGrid genre navigation (bug #19)', () => {
  it.each(['Pop', 'Rock'])('opens the %s genre subpage', (genreName) => {
    renderGrid()

    fireEvent.click(screen.getByRole('link', { name: genreName }))

    expect(screen.getByText('Genre destination')).toBeInTheDocument()
  })
})
