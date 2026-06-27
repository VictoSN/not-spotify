import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistAddableRow } from './PlaylistAddableRow'
import type { Track } from '@/types/track'

const track: Track = {
  id: 'phase-16-track',
  title: 'Cover Action Track',
  durationMs: 180_000,
  audioUrl: '/track.mp3',
  previewUrl: null,
  trackNumber: 1,
  discNumber: 1,
  explicit: false,
  playCount: 0,
  ratingCount: 0,
  averageRating: 0,
  artist: { id: 'artist-16', name: 'Cover Artist', imageUrl: null },
  album: { id: 'album-16', title: 'Cover Album', coverUrl: '/cover.jpg', releaseDate: '2026-01-01', type: 'album' },
  genres: [],
  createdAt: '2026-01-01T00:00:00Z',
}

describe('PlaylistAddableRow', () => {
  it('places the keyboard-accessible add action over the cover hover/focus zone', () => {
    render(<PlaylistAddableRow track={track} onAdd={vi.fn()} />)

    const button = screen.getByRole('button', { name: `Add ${track.title} to this playlist` })
    expect(button.parentElement).toContainElement(screen.getByRole('img', { name: track.album.title }))
    expect(button).toHaveClass('md:group-hover/add-row:opacity-100')
    expect(button).toHaveClass('md:group-focus-within/add-row:opacity-100')
    expect(button).toHaveClass('focus-visible:opacity-100')
    button.focus()
    expect(button).toHaveFocus()
  })

  it('locks rapid clicks so the existing add handler runs exactly once', () => {
    const onAdd = vi.fn(() => new Promise<void>(() => {}))
    render(<PlaylistAddableRow track={track} onAdd={onAdd} />)

    const button = screen.getByRole('button', { name: `Add ${track.title} to this playlist` })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('shows a persistent checked state and disables duplicate adds', () => {
    const onAdd = vi.fn()
    render(<PlaylistAddableRow track={track} onAdd={onAdd} added />)

    const button = screen.getByRole('button', { name: `${track.title} added to this playlist` })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Added to this playlist')
    expect(button).toHaveClass('opacity-100')
    fireEvent.click(button)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('does not turn ordinary row click, context-menu, or drag events into adds', () => {
    const onAdd = vi.fn()
    const onClick = vi.fn()
    const onContextMenu = vi.fn()
    const onDragStart = vi.fn()
    render(
      <div onClick={onClick} onContextMenu={onContextMenu} onDragStart={onDragStart} draggable>
        <PlaylistAddableRow track={track} onAdd={onAdd} />
      </div>,
    )

    const title = screen.getByText(track.title)
    fireEvent.click(title)
    fireEvent.contextMenu(title)
    fireEvent.dragStart(title)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onContextMenu).toHaveBeenCalledTimes(1)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
