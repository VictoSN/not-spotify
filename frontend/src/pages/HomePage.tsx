import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon } from '@heroicons/react/24/solid'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import type { Track } from '@/types/track'
import type { Playlist } from '@/types/playlist'
import type { Album } from '@/types/album'
import type { Artist } from '@/types/artist'
import { trackService } from '@/services/trackService'
import { playlistService } from '@/services/playlistService'
import { albumService } from '@/services/albumService'
import { artistService } from '@/services/artistService'
import { useAuthStore } from '@/stores/authStore'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useHueStore } from '@/stores/hueStore'
import { useDominantColor, getDominantColor } from '@/hooks/useDominantColor'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { SectionHeader } from '@/components/common/SectionHeader'
import { HorizontalScroller } from '@/components/common/HorizontalScroller'
import { PlaylistCard } from '@/components/cards/PlaylistCard'
import { AlbumCard } from '@/components/cards/AlbumCard'
import { ArtistCard } from '@/components/cards/ArtistCard'
import { TrackTile } from '@/components/cards/TrackTile'
import { Spinner } from '@/components/ui/Spinner'

const PREVIEW_LIMIT = 10

export function HomePage() {
  const { user, isAuthenticated } = useAuthStore()
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const playWithGate = usePlaybackGate()
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const [trending, setTrending] = useState<Track[]>([])
  const [recommendedPlaylists, setRecommendedPlaylists] = useState<Playlist[]>([])
  const [newReleases, setNewReleases] = useState<Album[]>([])
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([])
  const [recents, setRecents] = useState<Track[]>([])
  const [popularArtists, setPopularArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Recents are user-scoped and the endpoint requires auth — for anon users we
    // just return an empty list rather than firing a guaranteed 401.
    const recentsCall = isAuthenticated
      ? trackService.getRecents(PREVIEW_LIMIT).catch(() => [] as Track[])
      : Promise.resolve([] as Track[])

    Promise.all([
      trackService.getTrending(PREVIEW_LIMIT),
      playlistService.getRecommended(PREVIEW_LIMIT),
      albumService.getNewReleases(PREVIEW_LIMIT),
      trackService.getRecommended(PREVIEW_LIMIT),
      recentsCall,
      artistService.getPopular(PREVIEW_LIMIT),
    ])
      .then(([tr, rp, nr, rt, rc, pa]) => {
        setTrending(tr)
        setRecommendedPlaylists(rp)
        setNewReleases(nr)
        setRecommendedTracks(rt)
        setRecents(rc)
        setPopularArtists(pa)
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  // Cover-derived hue for the top of the page (reflects what's playing, else a featured cover).
  const heroSeed =
    currentTrack?.album.coverUrl ??
    recommendedTracks[0]?.album.coverUrl ??
    savedPlaylists.find((p) => p.coverUrl)?.coverUrl ??
    null
  const baseColor = useDominantColor(heroSeed)
  const hoverColor = useHueStore((s) => s.hoverColor)
  const setHoverColor = useHueStore((s) => s.setHoverColor)
  // Hovering a card tints the hue toward that cover; otherwise follow the playing track.
  const heroColor = hoverColor ?? baseColor

  useEffect(() => () => setHoverColor(null), [setHoverColor])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const quickPicks = savedPlaylists.slice(0, 6)

  return (
    <div className="relative">
      {/* Dynamic colour hue — smoothly crossfades to the hovered card's colour */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60 transition-colors duration-500"
        style={{
          backgroundColor: heroColor ?? 'transparent',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
        }}
      />

      <div className="relative px-6 py-6">
        {isAuthenticated && (
          <h1 className="text-3xl font-bold text-primary mb-6">
            {getGreeting()}
            {user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        )}

        {/* Upgrade nudge for free-tier users */}
        {isAuthenticated && user?.capabilities?.unlimitedPlayback === false && (
          <div className="mb-8 flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-accent-dim to-surface px-5 py-4 ring-1 ring-accent/20">
            <div className="min-w-0">
              <p className="text-sm font-black text-primary">You're on the Free plan</p>
              <p className="mt-0.5 text-xs text-secondary">Shuffle-only playback · no repeat · limited controls</p>
            </div>
            <Link
              to="/premium"
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
            >
              <SparklesIcon className="h-4 w-4" />
              Explore Premium
            </Link>
          </div>
        )}

        {/* Quick access — the same library shown in the sidebar */}
        {isAuthenticated && quickPicks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {quickPicks.map((p) => {
              const tracks = p.tracks?.map((pt) => pt.track) ?? []
              return (
                <Link
                  key={p.id}
                  to={`/playlist/${p.id}`}
                  onMouseEnter={() => {
                    if (p.coverUrl) getDominantColor(p.coverUrl).then((c) => c && setHoverColor(c))
                  }}
                  onMouseLeave={() => setHoverColor(null)}
                  className="relative flex items-center gap-3 bg-elevated/40 hover:bg-elevated rounded-md overflow-hidden group transition-colors"
                >
                  <div className="w-14 h-14 shrink-0 bg-surface flex items-center justify-center overflow-hidden">
                    {p.coverUrl ? (
                      <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <MusicalNoteIcon className="w-6 h-6 text-secondary" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-primary truncate pr-2 flex-1">{p.name}</span>
                  {tracks.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        playWithGate(tracks[0], tracks)
                      }}
                      className="mr-3 w-10 h-10 shrink-0 rounded-full bg-accent flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95 transition-all shadow-lg"
                      aria-label={`Play ${p.name}`}
                    >
                      <PlayIcon className="w-5 h-5 text-white ml-0.5" />
                    </button>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Recommended for you (tracks) — auth only */}
        {isAuthenticated && recommendedTracks.length > 0 && (
          <section className="mb-8">
            <SectionHeader title="Recommended for you" href="/recommended-tracks" />
            <HorizontalScroller>
              {recommendedTracks.map((track) => (
                <TrackTile key={track.id} track={track} queue={recommendedTracks} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Trending now — horizontal card row (was a vertical list) */}
        {trending.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={isAuthenticated ? 'Trending now' : 'Trending songs'} href="/trending" />
            <HorizontalScroller>
              {trending.slice(0, PREVIEW_LIMIT).map((track) => (
                <TrackTile key={track.id} track={track} queue={trending} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Recents — auth only, hidden until the user has played something */}
        {isAuthenticated && recents.length > 0 && (
          <section className="mb-8">
            <SectionHeader title="Recents" href="/recents" />
            <HorizontalScroller>
              {recents.map((track) => (
                <TrackTile key={track.id} track={track} queue={recents} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Recommended playlists */}
        {recommendedPlaylists.length > 0 && (
          <section className="mb-8">
            <SectionHeader title="Recommended playlists" href="/playlists" />
            <HorizontalScroller>
              {recommendedPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* Popular artists */}
        {popularArtists.length > 0 && (
          <section className="mb-8">
            <SectionHeader title="Popular artists" href="/popular-artists" />
            <HorizontalScroller>
              {popularArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </HorizontalScroller>
          </section>
        )}

        {/* New releases */}
        {newReleases.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={isAuthenticated ? 'New releases' : 'Popular albums and singles'} href="/new-releases" />
            <HorizontalScroller>
              {newReleases.slice(0, PREVIEW_LIMIT).map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </HorizontalScroller>
          </section>
        )}
      </div>
    </div>
  )
}
