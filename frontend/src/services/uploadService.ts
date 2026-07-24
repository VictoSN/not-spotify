import type { UserUpload } from '@/types/upload'
import { api, refreshAccessToken } from './api'

/** Read an audio file's duration (ms) in the browser before upload. */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('audio')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : 0)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    el.src = url
  })
}

/**
 * Direct-to-S3 uploads via the presign Lambda behind API Gateway.
 *
 * With VITE_UPLOADS_API_URL set, the file goes straight from the browser to S3 and the
 * ASP.NET API only sees a small JSON call registering the finished object. Without it,
 * everything falls back to the original multipart POST through the API, so the app works
 * with or without the Lambda deployed. See docs/aws-lambda-setup.md.
 */
const PRESIGN_URL = (import.meta.env.VITE_UPLOADS_API_URL ?? '').replace(/\/+$/, '')

export const isDirectUploadEnabled = () => PRESIGN_URL.length > 0

interface PresignResponse {
  upload: { url: string; fields: Record<string, string> }
  key: string
  contentType: string
  maxBytes: number
  expiresIn: number
}

export interface UploadOptions {
  title?: string
  artist?: string
  durationMs?: number
  /** 0-100, reported during the transfer. */
  onProgress?: (percent: number) => void
}

/** Error whose message is already suitable to show the user. */
class UploadError extends Error {
  /** True when the *service* failed rather than this file, so another path may be tried. */
  readonly retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = 'UploadError'
    this.retryable = retryable
  }
}

function accessToken(): string | undefined {
  return (window as { __authToken?: string }).__authToken
}

/**
 * Ask the Lambda where this file may go. Retries once through a token refresh: access
 * tokens last ~15 minutes and an open locker page outlives that easily, and unlike the
 * axios client this call has no interceptor doing the refresh for us.
 */
async function requestPresign(file: File, retrying = false): Promise<PresignResponse> {
  let res: Response
  try {
    res = await fetch(`${PRESIGN_URL}/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}),
      },
      body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
    })
  } catch {
    throw new UploadError('Could not reach the upload service.', true)
  }

  if (res.status === 401 && !retrying) {
    await refreshAccessToken()
    return requestPresign(file, true)
  }

  const payload = (await res.json().catch(() => null)) as { message?: string } | null
  if (!res.ok) {
    // 5xx means the endpoint is broken rather than the request; a 4xx is about this
    // file and must reach the user instead of being quietly retried elsewhere.
    throw new UploadError(payload?.message ?? 'Could not start the upload.', res.status >= 500)
  }
  return payload as unknown as PresignResponse
}

/**
 * POST the file straight to S3 using the presigned policy. XHR rather than fetch purely
 * for upload progress events, which fetch still cannot report.
 */
function postToS3(presigned: PresignResponse, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData()
    // S3 requires every policy field to precede the file part and ignores anything after
    // it - this append order is part of the contract, not style.
    for (const [name, value] of Object.entries(presigned.upload.fields)) form.append(name, value)
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', presigned.upload.url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      // S3 answers failures with an XML document whose <Message> explains which policy
      // condition was violated - far more useful than the bare status code.
      else reject(new UploadError(parseS3Error(xhr.responseText) ?? `Upload failed (${xhr.status}).`, false))
    }
    xhr.onerror = () => reject(new UploadError('The upload was blocked or the connection dropped.', false))
    xhr.onabort = () => reject(new UploadError('Upload cancelled.', false))
    xhr.send(form)
  })
}

function parseS3Error(xml: string): string | null {
  const match = /<Message>([^<]+)<\/Message>/.exec(xml ?? '')
  return match ? match[1] : null
}

async function uploadDirect(file: File, opts: UploadOptions): Promise<UserUpload> {
  const presigned = await requestPresign(file)
  opts.onProgress?.(0)
  await postToS3(presigned, file, opts.onProgress)

  // The object exists but nothing in the app knows about it yet. The API re-checks the
  // key's ownership and the object's real size against S3 before creating the row - the
  // browser's claim that the upload worked is not evidence.
  const res = await api.post<UserUpload>('/me/uploads/complete', {
    key: presigned.key,
    title: opts.title,
    artist: opts.artist,
    durationMs: opts.durationMs ?? 0,
  })
  opts.onProgress?.(100)
  return res.data
}

async function uploadMultipart(file: File, opts: UploadOptions): Promise<UserUpload> {
  const fd = new FormData()
  fd.append('file', file)
  if (opts.title) fd.append('title', opts.title)
  if (opts.artist) fd.append('artist', opts.artist)
  fd.append('durationMs', String(opts.durationMs ?? 0))
  const res = await api.post<UserUpload>('/me/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total) opts.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  })
  return res.data
}

export const uploadService = {
  async list(): Promise<UserUpload[]> {
    const res = await api.get<UserUpload[]>('/me/uploads')
    return res.data
  },

  async upload(file: File, opts: UploadOptions = {}): Promise<UserUpload> {
    if (!isDirectUploadEnabled()) return uploadMultipart(file, opts)
    try {
      return await uploadDirect(file, opts)
    } catch (err) {
      // Fall back only when the presign service is unreachable or broken. A rejection
      // about *this file* (too large, wrong type, not signed in) surfaces as-is -
      // retrying it through the API would either fail again or quietly bypass the limit
      // the Lambda just enforced.
      if (err instanceof UploadError && err.retryable) {
        console.warn('[uploads] presign unavailable, falling back to the API path', err)
        return uploadMultipart(file, opts)
      }
      throw err
    }
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/me/uploads/${id}`)
  },

  async uploadCover(id: string, file: File): Promise<UserUpload> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<UserUpload>(`/me/uploads/${id}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
