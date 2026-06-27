import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  const renderRow = (row: React.ReactNode) => render(<MemoryRouter>{row}</MemoryRouter>)

  it('places the keyboard-accessible add action over the cover hover/focus zone', () => {
    renderRow(<PlaylistAddableRow track={track} onAdd={vi.fn()} />)

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
    renderRow(<PlaylistAddableRow track={track} onAdd={onAdd} />)

    const button = screen.getByRole('button', { name: `Add ${track.title} to this playlist` })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('uses a disabled in-flight state without rendering an added checkmark', () => {
    const onAdd = vi.fn()
    renderRow(<PlaylistAddableRow track={track} onAdd={onAdd} adding />)

    const button = screen.getByRole('button', { name: `Adding ${track.title} to this playlist` })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Adding to this playlist')
    expect(button).toHaveClass('opacity-100')
    expect(button.querySelector('svg')).toBeInTheDocument()
    fireEvent.click(button)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('links the cover/title to the track and the metadata to artist and album pages', () => {
    renderRow(<PlaylistAddableRow track={track} onAdd={vi.fn()} />)

    expect(screen.getByRole('link', { name: `Open ${track.title}` })).toHaveAttribute('href', `/track/${track.id}`)
    expect(screen.getByRole('link', { name: track.title })).toHaveAttribute('href', `/track/${track.id}`)
    expect(screen.getByRole('link', { name: track.artist.name })).toHaveAttribute('href', `/artist/${track.artist.id}`)
    expect(screen.getByRole('link', { name: track.album.title })).toHaveAttribute('href', `/album/${track.album.id}`)
  })

  it('does not turn ordinary row click, context-menu, or drag events into adds', () => {
    const onAdd = vi.fn()
    const onClick = vi.fn()
    const onContextMenu = vi.fn()
    const onDragStart = vi.fn()
    renderRow(
      <div onClick={onClick} onContextMenu={onContextMenu} onDragStart={onDragStart} draggable>
        <PlaylistAddableRow track={track} onAdd={onAdd} />
      </div>,
    )

    const row = screen.getByTestId(`playlist-add-row-${track.id}`)
    fireEvent.click(row)
    fireEvent.contextMenu(row)
    fireEvent.dragStart(row)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onContextMenu).toHaveBeenCalledTimes(1)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
