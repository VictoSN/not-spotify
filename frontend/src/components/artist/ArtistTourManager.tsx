import React, { useEffect, useMemo, useState } from 'react'
import {
  PlusCircleIcon, TrashIcon, PencilSquareIcon, MapPinIcon,
  MusicalNoteIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { useConfirm } from '@/hooks/useConfirm'
import { meService, type TourDatePayload } from '@/services/meService'
import type { TourDate } from '@/types/artist'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/utils/toast'

interface Props {
  /** The artist's own tracks, used to build a setlist. */
  tracks: { id: string; title: string }[]
}

const emptyForm = (): TourDatePayload => ({ eventDate: '', city: '', venue: '', country: '', ticketUrl: '' })
const byDate = (a: TourDate, b: TourDate) => a.eventDate.localeCompare(b.eventDate)

/** Convert a stored ISO timestamp to the value a <input type="datetime-local"> expects (local time). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ArtistTourManager({ tracks }: Props) {
  const confirm = useConfirm()
  const [dates, setDates] = useState<TourDate[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TourDatePayload>(emptyForm())
  const [saving, setSaving] = useState(false)

  // Setlist editor state (one date at a time).
  const [setlistFor, setSetlistFor] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [savingSetlist, setSavingSetlist] = useState(false)

  useEffect(() => {
    meService.getArtistTour().then((d) => setDates([...d].sort(byDate))).catch(() => setDates([]))
  }, [])

  const trackTitle = useMemo(() => {
    const m = new Map(tracks.map((t) => [t.id, t.title]))
    return (id: string) => m.get(id) ?? 'Unknown track'
  }, [tracks])

  const openCreate = () => { setForm(emptyForm()); setEditingId(null); setShowForm(true) }
  const openEdit = (d: TourDate) => {
    setForm({ eventDate: toLocalInput(d.eventDate), city: d.city, venue: d.venue, country: d.country ?? '', ticketUrl: d.ticketUrl ?? '' })
    setEditingId(d.id); setShowForm(true)
  }
  const resetForm = () => { setForm(emptyForm()); setEditingId(null); setShowForm(false) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.eventDate || !form.city.trim() || !form.venue.trim()) {
      notify.error('Date, city and venue are required.')
      return
    }
    setSaving(true)
    try {
      const payload: TourDatePayload = {
        eventDate: new Date(form.eventDate).toISOString(),
        city: form.city.trim(),
        venue: form.venue.trim(),
        country: form.country?.trim() || null,
        ticketUrl: form.ticketUrl?.trim() || null,
      }
      if (editingId) {
        const updated = await meService.updateArtistTourDate(editingId, payload)
        setDates((cur) => [...(cur ?? []).map((x) => (x.id === editingId ? updated : x))].sort(byDate))
        notify.success('Show updated.')
      } else {
        const created = await meService.createArtistTourDate(payload)
        setDates((cur) => [...(cur ?? []), created].sort(byDate))
        notify.success('Show added.')
      }
      resetForm()
    } catch {
      notify.error('Could not save the show.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (d: TourDate) => {
    const ok = await confirm({
      title: 'Cancel this show?',
      message: `${d.city} · ${d.venue} will be removed from your tour.`,
      confirmText: 'Cancel show',
      danger: true,
    })
    if (!ok) return
    try {
      await meService.deleteArtistTourDate(d.id)
      setDates((cur) => (cur ?? []).filter((x) => x.id !== d.id))
      if (setlistFor === d.id) setSetlistFor(null)
      notify.success('Show cancelled.')
    } catch {
      notify.error('Could not cancel the show.')
    }
  }

  const openSetlist = (d: TourDate) => {
    setSetlistFor(d.id)
    setSelected(d.songs.map((s) => s.trackId))
  }
  const toggleSong = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const saveSetlist = async (id: string) => {
    setSavingSetlist(true)
    try {
      const updated = await meService.setArtistTourSetlist(id, selected)
      setDates((cur) => (cur ?? []).map((x) => (x.id === id ? updated : x)))
      setSetlistFor(null)
      notify.success('Setlist saved.')
    } catch {
      notify.error('Could not save the setlist.')
    } finally {
      setSavingSetlist(false)
    }
  }

  if (dates === null) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">Tours & concerts</h2>
          <p className="text-xs text-secondary">Announce shows, attach a setlist, and link out to where fans buy tickets.</p>
        </div>
        {!showForm && (
          <Button onClick={openCreate} className="shrink-0">
            <PlusCircleIcon className="mr-1.5 h-5 w-5" /> Add Event
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={save} className="space-y-3 rounded-xl bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Date &amp; time</span>
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Ticket link (optional)</span>
              <input
                type="url"
                inputMode="url"
                placeholder="https://tickets.example.com/…"
                value={form.ticketUrl ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ticketUrl: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">City</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Venue</span>
              <input
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                className="w-full rounded-lg bg-elevated px-3 py-2 text-primary outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-secondary">Country (ISO code, e.g. US)</span>
              <input
                value={form.country ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                maxLength={2}
                className="w-full rounded-lg bg-elevated px-3 py-2 uppercase text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add Event'}</Button>
            <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Cancel</Button>
          </div>
        </form>
      )}

      {dates.length === 0 && !showForm && (
        <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-secondary">
          No shows yet. Add your first tour date — it shows up on your public artist page.
        </p>
      )}

      <div className="space-y-2">
        {dates.map((d) => {
          const date = new Date(d.eventDate)
          const isEditingSetlist = setlistFor === d.id
          return (
            <div key={d.id} className="rounded-xl bg-surface p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-elevated text-center leading-none">
                  <span className="text-[10px] font-bold uppercase text-secondary">{date.toLocaleDateString(undefined, { month: 'short' })}</span>
                  <span className="text-lg font-black text-primary">{date.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">{d.city}{d.country ? `, ${d.country}` : ''}</p>
                  <p className="truncate text-xs text-secondary">
                    <MapPinIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />{d.venue}
                    {d.songs.length > 0 && <span className="ml-2">· {d.songs.length} song{d.songs.length === 1 ? '' : 's'}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => openSetlist(d)} title="Edit setlist" className="rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-primary">
                    <MusicalNoteIcon className="h-5 w-5" />
                  </button>
                  <button onClick={() => openEdit(d)} title="Edit show" className="rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-primary">
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button onClick={() => remove(d)} title="Cancel show" className="rounded-full p-2 text-secondary transition-colors hover:bg-elevated hover:text-red-400">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {isEditingSetlist && (
                <div className="mt-3 rounded-lg bg-elevated p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">Setlist <span className="text-secondary">({selected.length} selected)</span></p>
                    <div className="flex gap-1">
                      <Button onClick={() => saveSetlist(d.id)} disabled={savingSetlist} className="!px-3 !py-1 text-xs">
                        <CheckIcon className="mr-1 h-4 w-4" />{savingSetlist ? 'Saving…' : 'Save'}
                      </Button>
                      <button onClick={() => setSetlistFor(null)} className="rounded-full p-1.5 text-secondary hover:text-primary"><XMarkIcon className="h-5 w-5" /></button>
                    </div>
                  </div>
                  {tracks.length === 0 ? (
                    <p className="py-3 text-center text-xs text-secondary">Upload some tracks first — then add them to this show's setlist.</p>
                  ) : (
                    <ul className="max-h-60 space-y-0.5 overflow-y-auto">
                      {tracks.map((tr) => {
                        const order = selected.indexOf(tr.id)
                        const on = order >= 0
                        return (
                          <li key={tr.id}>
                            <button
                              onClick={() => toggleSong(tr.id)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${on ? 'bg-accent/15 text-primary' : 'text-secondary hover:bg-surface'}`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${on ? 'border-accent bg-accent text-page' : 'border-secondary/50'}`}>
                                {on ? order + 1 : ''}
                              </span>
                              <span className="truncate">{tr.title}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}

              {!isEditingSetlist && d.songs.length > 0 && (
                <ol className="mt-2 list-inside list-decimal space-y-0.5 pl-1 text-xs text-secondary">
                  {d.songs.map((s) => <li key={s.trackId} className="truncate">{trackTitle(s.trackId)}</li>)}
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
