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

export const uploadService = {
  async list(): Promise<UserUpload[]> {
    const res = await api.get<UserUpload[]>('/me/uploads')
    return res.data
  },

  async upload(file: File, opts: { title?: string; artist?: string; durationMs?: number } = {}): Promise<UserUpload> {
    const fd = new FormData()
    fd.append('file', file)
    if (opts.title) fd.append('title', opts.title)
    if (opts.artist) fd.append('artist', opts.artist)
    fd.append('durationMs', String(opts.durationMs ?? 0))
    const res = await api.post<UserUpload>('/me/uploads', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/me/uploads/${id}`)
  },
}
