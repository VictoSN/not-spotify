import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { MoodTag } from '@/types/mood'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'
import { moodService } from '@/services/moodService'
import { searchService } from '@/services/searchService'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { moodIcon } from '@/utils/moodIcons'

export function MoodDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [mood, setMood] = useState<MoodTag | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [fromSearch, setFromSearch] = useState(false)
  const [loading, setLoading] = useState(true)

  useDocumentTitle(mood ? mood.name : 'Mood')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const tag = await moodService.getBySlug(slug)
        if (cancelled) return
        setMood(tag)

        const [tagged, p] = await Promise.all([
          moodService.getTracksByMood(slug),
          moodService.getPlaylistsByMood(slug),
        ])
        if (cancelled) return
        setPlaylists(p)

        if (tagged.length > 0) {
          setTracks(tagged)
          setFromSearch(false)
        } else if (tag.searchQuery) {
          const res = await searchService.search(tag.searchQuery)
          if (cancelled) return
          setTracks(res.tracks)
          setFromSearch(true)
        }
      } catch {
        if (!cancelled) setMood(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  if (!mood) return <div className="p-8 text-secondary">Mood not found.</div>

  const Icon = moodIcon(mood.icon)

  return (
    <div>
      <div className="flex h-40 items-end gap-4 px-6 pb-6" style={{ backgroundColor: mood.color }}>
        <Icon className="h-12 w-12 text-white/85" />
        <h1 className="text-5xl font-black text-white drop-shadow-lg">{mood.name}</h1>
      </div>
      <div className="px-6 py-6">
        {playlists.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-primary">Playlists</h2>
            <div className="flex flex-wrap gap-4">
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          </section>
        )}

        {tracks.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-1 text-xl font-bold text-primary">Tracks</h2>
            {fromSearch && (
              <p className="mb-3 text-xs text-secondary">
                No tracks tagged yet — showing catalogue matches for “{mood.searchQuery}”.
              </p>
            )}
            <HorizontalScroller>
              {tracks.map((track) => (
                <TrackTile key={track.id} track={track} queue={tracks} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {playlists.length === 0 && tracks.length === 0 && (
          <div className="rounded-lg border border-elevated/40 bg-surface px-6 py-12 text-center text-secondary">
            Nothing has been tagged with {mood.name} yet.
          </div>
        )}
      </div>
    </div>
  )
}
