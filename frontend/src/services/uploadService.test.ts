import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Covers the direct-to-S3 upload path and, more importantly, when it is allowed to
 * fall back to the old multipart route. Getting that wrong either hides a real error
 * from the user or silently bypasses the size limit the Lambda just enforced.
 *
 * PRESIGN_URL is read from import.meta.env at module load, so every test stubs the env
 * and re-imports rather than sharing one instance.
 */

const PRESIGN_ORIGIN = 'https://presign.example.com'

const apiMock = {
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}
const refreshAccessToken = vi.fn()

vi.mock('./api', () => ({
  api: apiMock,
  refreshAccessToken: () => refreshAccessToken(),
}))

/** Minimal XMLHttpRequest stand-in; jsdom's cannot actually transfer anything. */
class FakeXhr {
  static last: FakeXhr | null = null
  static behaviour: { status: number; responseText: string } | 'network-error' = {
    status: 204,
    responseText: '',
  }

  status = 0
  responseText = ''
  method = ''
  url = ''
  sent: FormData | null = null
  upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.last = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  send(body: FormData) {
    this.sent = body
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 })
      if (FakeXhr.behaviour === 'network-error') {
        this.onerror?.()
        return
      }
      this.status = FakeXhr.behaviour.status
      this.responseText = FakeXhr.behaviour.responseText
      this.onload?.()
    })
  }
}

function presignPayload(key = 'uploads/user-1/abc.mp3') {
  return {
    upload: {
      url: 'https://bucket.s3.amazonaws.com/',
      fields: { 'Content-Type': 'audio/mpeg', key, policy: 'p', 'x-amz-signature': 's' },
    },
    key,
    contentType: 'audio/mpeg',
    maxBytes: 104857600,
    expiresIn: 900,
  }
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

async function loadService(presignUrl: string | undefined) {
  vi.resetModules()
  vi.stubEnv('VITE_UPLOADS_API_URL', presignUrl ?? '')
  return import('./uploadService')
}

const file = () => new File(['audio-bytes'], 'demo.mp3', { type: 'audio/mpeg' })

describe('uploadService', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr as unknown as typeof XMLHttpRequest)
    FakeXhr.behaviour = { status: 204, responseText: '' }
    FakeXhr.last = null
    apiMock.post.mockReset().mockResolvedValue({ data: { id: 'u1', title: 'demo' } })
    refreshAccessToken.mockReset().mockResolvedValue('new-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe('without VITE_UPLOADS_API_URL', () => {
    it('reports the direct path as disabled and posts through the API', async () => {
      const { uploadService, isDirectUploadEnabled } = await loadService(undefined)
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      await uploadService.upload(file())

      expect(isDirectUploadEnabled()).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(apiMock.post).toHaveBeenCalledWith('/me/uploads', expect.any(FormData), expect.anything())
    })
  })

  describe('with the presign endpoint configured', () => {
    it('presigns, posts to S3, then registers the key with the API', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, presignPayload())))

      await uploadService.upload(file(), { durationMs: 61000, title: 'Demo' })

      expect(FakeXhr.last?.url).toBe('https://bucket.s3.amazonaws.com/')
      expect(apiMock.post).toHaveBeenCalledWith('/me/uploads/complete', {
        key: 'uploads/user-1/abc.mp3',
        title: 'Demo',
        artist: undefined,
        durationMs: 61000,
      })
      // The file must never reach the app's own API on this path.
      expect(apiMock.post).not.toHaveBeenCalledWith('/me/uploads', expect.anything(), expect.anything())
    })

    it('sends every policy field before the file part', async () => {
      // S3 ignores fields that appear after the file, so order is a correctness issue.
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, presignPayload())))

      await uploadService.upload(file())

      const names = [...(FakeXhr.last!.sent as FormData).keys()]
      expect(names[names.length - 1]).toBe('file')
      expect(names).toContain('policy')
      expect(names).toContain('x-amz-signature')
    })

    it('reports transfer progress', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, presignPayload())))
      const onProgress = vi.fn()

      await uploadService.upload(file(), { onProgress })

      expect(onProgress).toHaveBeenCalledWith(50)
      expect(onProgress).toHaveBeenCalledWith(100)
    })

    it('retries once through a token refresh on 401', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, { message: 'Token has expired.' }))
        .mockResolvedValueOnce(jsonResponse(200, presignPayload()))
      vi.stubGlobal('fetch', fetchSpy)

      await uploadService.upload(file())

      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('surfaces a rejection about the file instead of falling back', async () => {
      // Falling back here would push a file the Lambda just refused through the API.
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(413, { message: 'That file is 500 MB. The limit is 100 MB.' })))

      await expect(uploadService.upload(file())).rejects.toThrow('That file is 500 MB. The limit is 100 MB.')
      expect(apiMock.post).not.toHaveBeenCalled()
    })

    it('falls back to the API path when the presign service is unreachable', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      await uploadService.upload(file())

      expect(apiMock.post).toHaveBeenCalledWith('/me/uploads', expect.any(FormData), expect.anything())
    })

    it('falls back to the API path when the presign service returns 5xx', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { message: 'boom' })))

      await uploadService.upload(file())

      expect(apiMock.post).toHaveBeenCalledWith('/me/uploads', expect.any(FormData), expect.anything())
    })

    it('surfaces the S3 error message when the upload itself is rejected', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, presignPayload())))
      FakeXhr.behaviour = {
        status: 403,
        responseText: '<Error><Message>Policy Condition failed: content-length-range</Message></Error>',
      }

      await expect(uploadService.upload(file())).rejects.toThrow(/content-length-range/)
      expect(apiMock.post).not.toHaveBeenCalled()
    })

    it('does not fall back when S3 itself rejects the transfer', async () => {
      const { uploadService } = await loadService(PRESIGN_ORIGIN)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, presignPayload())))
      FakeXhr.behaviour = 'network-error'

      await expect(uploadService.upload(file())).rejects.toThrow()
      expect(apiMock.post).not.toHaveBeenCalled()
    })
  })
})
