import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpTrayIcon, TrashIcon, PlayIcon, PauseIcon, MusicalNoteIcon } from '@heroicons/react/24/solid'
import type { UserUpload } from '@/types/upload'
import { uploadToTrack } from '@/types/upload'
import { uploadService, readAudioDuration, isDirectUploadEnabled } from '@/services/uploadService'
import { usePlayerStore } from '@/stores/playerStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PlaylistCover } from '@/components/cards/PlaylistCover'
import { useConfirm } from '@/hooks/useConfirm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { notify } from '@/utils/toast'
import { formatMs } from '@/utils/formatTime'

export function UploadsPage() {
  const confirm = useConfirm()
  useDocumentTitle('Your uploads')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const coverRef = useRef<HTMLInputElement | null>(null)
  const [uploads, setUploads] = useState<UserUpload[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const play = usePlayerStore((s) => s.play)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)

  useEffect(() => {
    uploadService.list().then(setUploads).catch(() => setUploads([])).finally(() => setLoading(false))
  }, [])

  const queue = useMemo(() => uploads.map((u) => uploadToTrack(u)), [uploads])

  const chooseAudio = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setAudioFile(file)
    setTitle((current) => current.trim() || file.name.replace(/\.[^.]+$/, ''))
  }

  const upload = async () => {
    if (!audioFile) return
    setBusy(true)
    setProgress(0)
    try {
      const durationMs = await readAudioDuration(audioFile)
      let created = await uploadService.upload(audioFile, {
        title: title.trim() || undefined,
        durationMs,
        onProgress: setProgress,
      })
      // Covers are deliberately handled by the authenticated API, not the audio Lambda:
      // the file is small and this keeps the Lambda limited to its direct-to-S3 audio role.
      if (coverFile) created = await uploadService.uploadCover(created.id, coverFile)
      setUploads((prev) => [created, ...prev])
      setAudioFile(null)
      setCoverFile(null)
      setTitle('')
      notify.success('Uploaded.')
    } catch (err) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notify.error(apiMsg ?? (err as Error)?.message ?? 'Upload failed.')
    } finally {
      setBusy(false)
      setProgress(null)
      if (fileRef.current) fileRef.current.value = ''
      if (coverRef.current) coverRef.current.value = ''
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
        <p className="mt-1 text-sm text-secondary">A private locker for your own audio — only you can see or play these.</p>
      </div>

      <div className="mb-6 rounded-lg border border-dashed border-elevated/60 bg-surface p-6">
        <MusicalNoteIcon className="mx-auto mb-2 h-8 w-8 text-secondary/60" />
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => chooseAudio(e.target.files)} />
        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
        <div className="mx-auto max-w-md space-y-3 text-left">
          <div className="flex items-center justify-between gap-3 rounded-md bg-page/50 px-3 py-2 text-sm">
            <span className="truncate text-secondary">{audioFile?.name ?? 'No audio selected'}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>Choose audio</Button>
          </div>
          <label className="block text-sm font-medium text-primary">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" maxLength={160} disabled={busy} className="mt-1 w-full rounded-md border border-elevated bg-page px-3 py-2 text-primary outline-none placeholder:text-secondary focus:border-accent" />
          </label>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-secondary">{coverFile?.name ?? 'Default playlist artwork will be used'}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => coverRef.current?.click()} disabled={busy}>Add cover</Button>
          </div>
          <div className="text-center">
            <Button type="button" onClick={upload} disabled={busy || !audioFile}>
              {busy ? <Spinner size="sm" /> : <ArrowUpTrayIcon className="h-4 w-4" />}
              {busy ? (progress === null ? 'Uploading…' : `Uploading… ${progress}%`) : 'Upload'}
            </Button>
          </div>
        </div>
        {busy && progress !== null && <div className="mx-auto mt-3 h-1 w-full max-w-xs overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>}
        <p className="mt-3 text-center text-xs text-secondary">MP3, M4A, WAV, FLAC, OGG, Opus · up to {isDirectUploadEnabled() ? '100' : '50'} MB. Covers: JPG, PNG, or WebP, up to 5 MB.</p>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : uploads.length === 0 ? (
        <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">Nothing uploaded yet.</div>
      ) : (
        <ul className="divide-y divide-elevated/40">
          {uploads.map((u) => {
            const isCurrent = currentTrack?.id === u.id
            const isThisPlaying = isCurrent && isPlaying
            return <li key={u.id} className="flex items-center gap-3 py-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-elevated"><PlaylistCover coverUrl={u.coverUrl} name={u.title} /></div>
              <button type="button" onClick={() => (isCurrent ? togglePlayPause() : play(uploadToTrack(u), queue))} aria-label={isThisPlaying ? `Pause ${u.title}` : `Play ${u.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-page transition-transform hover:scale-105">{isThisPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 translate-x-[1px]" />}</button>
              <div className="min-w-0 flex-1"><div className={`truncate font-semibold ${isCurrent ? 'text-accent' : 'text-primary'}`}>{u.title}</div><div className="truncate text-xs text-secondary">{u.artist ?? 'You'}</div></div>
              {u.durationMs > 0 && <span className="shrink-0 text-xs text-secondary">{formatMs(u.durationMs)}</span>}
              <button type="button" onClick={() => remove(u)} aria-label={`Delete ${u.title}`} className="shrink-0 rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
            </li>
          })}
        </ul>
      )}
    </div>
  )
}
