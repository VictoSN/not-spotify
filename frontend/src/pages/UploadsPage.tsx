import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpTrayIcon, TrashIcon, PlayIcon, PauseIcon, MusicalNoteIcon } from '@heroicons/react/24/solid'
import type { UserUpload } from '@/types/upload'
import { uploadToTrack } from '@/types/upload'
import { uploadService, readAudioDuration } from '@/services/uploadService'
import { usePlayerStore } from '@/stores/playerStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/hooks/useConfirm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { notify } from '@/utils/toast'
import { formatMs } from '@/utils/formatTime'

export function UploadsPage() {
  const confirm = useConfirm()
  useDocumentTitle('Your uploads')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploads, setUploads] = useState<UserUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const play = usePlayerStore((s) => s.play)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)

  useEffect(() => {
    uploadService.list()
      .then(setUploads)
      .catch(() => setUploads([]))
      .finally(() => setLoading(false))
  }, [])

  const queue = useMemo(() => uploads.map((u) => uploadToTrack(u)), [uploads])

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const durationMs = await readAudioDuration(file)
        const created = await uploadService.upload(file, { durationMs })
        setUploads((prev) => [created, ...prev])
      }
      notify.success(files.length === 1 ? 'Uploaded.' : `Uploaded ${files.length} files.`)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notify.error(msg ?? 'Upload failed.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (u: UserUpload) => {
    const ok = await confirm({ title: `Delete “${u.title}”?`, confirmText: 'Delete', danger: true })
    if (!ok) return
    try {
      await uploadService.remove(u.id)
      setUploads((prev) => prev.filter((x) => x.id !== u.id))
    } catch {
      notify.error('Could not delete the upload.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Your uploads</h1>
        <p className="mt-1 text-sm text-secondary">
          A private locker for your own audio — only you can see or play these.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-dashed border-elevated/60 bg-surface p-6 text-center">
        <MusicalNoteIcon className="mx-auto mb-2 h-8 w-8 text-secondary/60" />
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : <ArrowUpTrayIcon className="h-4 w-4" />}
          {busy ? 'Uploading…' : 'Upload audio'}
        </Button>
        <p className="mt-2 text-xs text-secondary">MP3, M4A, WAV, FLAC, OGG, Opus · up to 50 MB each</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : uploads.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
          Nothing uploaded yet.
        </div>
      ) : (
        <ul className="divide-y divide-elevated/40">
          {uploads.map((u) => {
            const isCurrent = currentTrack?.id === u.id
            const isThisPlaying = isCurrent && isPlaying
            return (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => (isCurrent ? togglePlayPause() : play(uploadToTrack(u), queue))}
                  aria-label={isThisPlaying ? `Pause ${u.title}` : `Play ${u.title}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-page transition-transform hover:scale-105"
                >
                  {isThisPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 translate-x-[1px]" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-semibold ${isCurrent ? 'text-accent' : 'text-primary'}`}>{u.title}</div>
                  <div className="truncate text-xs text-secondary">{u.artist ?? 'You'}</div>
                </div>
                {u.durationMs > 0 && <span className="shrink-0 text-xs text-secondary">{formatMs(u.durationMs)}</span>}
                <button
                  type="button"
                  onClick={() => remove(u)}
                  aria-label={`Delete ${u.title}`}
                  className="shrink-0 rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
