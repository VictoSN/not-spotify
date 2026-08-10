import type { UserUpload } from '@/types/upload'
import { api } from './api'

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

export interface UploadOptions {
  title?: string
  artist?: string
  durationMs?: number
  /** 0-100, reported during the transfer. */
  onProgress?: (percent: number) => void
}

async function uploadMultipart(file: File, opts: UploadOptions): Promise<UserUpload> {
  const fd = new FormData()
  fd.append('file', file)
  if (opts.title) fd.append('title', opts.title)
  if (opts.artist) fd.append('artist', opts.artist)
  fd.append('durationMs', String(opts.durationMs ?? 0))
  opts.onProgress?.(0)

  const res = await api.post<UserUpload>('/me/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total) opts.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  })
  opts.onProgress?.(100)
  return res.data
}

export const uploadService = {
  async list(): Promise<UserUpload[]> {
    const res = await api.get<UserUpload[]>('/me/uploads')
    return res.data
  },

  async upload(file: File, opts: UploadOptions = {}): Promise<UserUpload> {
    return uploadMultipart(file, opts)
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
