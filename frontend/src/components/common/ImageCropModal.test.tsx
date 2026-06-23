import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ImageCropModal } from './ImageCropModal'

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class FakeImage {
  naturalWidth = 0
  naturalHeight = 0
  complete = false
  onload: (() => void) | null = null
  private _src = ''

  set src(value: string) {
    this._src = value
    this.naturalWidth = 800
    this.naturalHeight = 600
    this.complete = true
  }

  get src() {
    return this._src
  }

  decode() {
    return Promise.resolve()
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('Image', FakeImage)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const fakeFile = () => new File(['x'], 'photo.png', { type: 'image/png' })

describe('ImageCropModal', () => {
  it('enables "Use image" once the source is measured without a DOM load event', async () => {
    render(
      <ImageCropModal file={fakeFile()} aspectRatio={1} title="Crop" onCancel={() => {}} onCrop={() => {}} />,
    )

    const button = await screen.findByRole('button', { name: /use image/i })
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.getByAltText('Crop preview')).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
  })

  it('shows no cropper actions when no file is provided', () => {
    render(
      <ImageCropModal file={null} aspectRatio={1} title="Crop" onCancel={() => {}} onCrop={() => {}} />,
    )

    expect(screen.queryByRole('button', { name: /use image/i })).toBeNull()
  })
})
