import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = {
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}

vi.mock('./api', () => ({ api: apiMock }))

const file = () => new File(['audio-bytes'], 'demo.mp3', { type: 'audio/mpeg' })

describe('uploadService', () => {
  beforeEach(() => {
    vi.resetModules()
    apiMock.post.mockReset().mockResolvedValue({ data: { id: 'u1', title: 'demo' } })
    apiMock.get.mockReset().mockResolvedValue({ data: [] })
    apiMock.delete.mockReset()
  })

  it('uploads audio through the local API multipart endpoint', async () => {
    const { uploadService } = await import('./uploadService')
    const onProgress = vi.fn()

    await uploadService.upload(file(), { title: 'Demo', durationMs: 61000, onProgress })

    const [url, body, config] = apiMock.post.mock.calls[0]
    expect(url).toBe('/me/uploads')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect((body as FormData).get('title')).toBe('Demo')
    expect((body as FormData).get('durationMs')).toBe('61000')
    expect(config).toEqual(expect.objectContaining({ onUploadProgress: expect.any(Function) }))
    expect(onProgress).toHaveBeenNthCalledWith(1, 0)
    expect(onProgress).toHaveBeenLastCalledWith(100)
  })

  it('uploads covers through the local API', async () => {
    const { uploadService } = await import('./uploadService')

    await uploadService.uploadCover('u1', new File(['cover'], 'cover.png', { type: 'image/png' }))

    expect(apiMock.post).toHaveBeenCalledWith(
      '/me/uploads/u1/cover',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    )
  })

  it('keeps list and delete operations on the API', async () => {
    const { uploadService } = await import('./uploadService')

    await uploadService.list()
    await uploadService.remove('u1')

    expect(apiMock.get).toHaveBeenCalledWith('/me/uploads')
    expect(apiMock.delete).toHaveBeenCalledWith('/me/uploads/u1')
  })
})
