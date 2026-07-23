import { useRef } from 'react'
import { Link } from 'react-router-dom'
import type { DailyMix } from '@/services/trackService'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayContextGate } from '@/hooks/usePlaybackGate'
import { usePlaybackContext } from '@/hooks/usePlaybackContext'
import { openMenuAtPointer } from '@/utils/contextMenu'
import { CardPlayButton } from './CardPlayButton'
import { MixMenu, type MixMenuHandle } from './MixMenu'

interface MixTileProps {
  mix: DailyMix
  flush?: boolean
  /** Render the title bold. Defaults to normal weight (Spotify-style); pass true where bold is wanted. */
  boldTitle?: boolean
}

const DAILY_MIX_ACCENTS = [
  '#16e5dc',
  '#e8f31d',
  '#ff3b30',
  '#ef8acb',
  '#c9f24a',
  '#aeb6ff',
]

/**
 * A "Daily Mix" tile: a 2x2 mosaic of the mix's album covers with a
 * genre-colored title band. Clicking the tile opens the mix detail page;
 * the play button loads the whole mix into the queue.
 */
export function MixTile({ mix, flush = false, boldTitle = false }: MixTileProps) {
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const startContext = usePlayContextGate()
  const { isActiveContext, isPlayingContext } = usePlaybackContext({ type: 'mix', id: mix.id })
  const menuRef = useRef<MixMenuHandle>(null)

  // First four distinct album covers for the mosaic.
  const covers: string[] = []
  for (const t of mix.tracks) {
    const url = t.album?.coverUrl
    if (url && !covers.includes(url)) covers.push(url)
    if (covers.length === 4) break
  }

  const playMix = () => {
    if (isActiveContext) togglePlayPause()
    else if (mix.tracks.length > 0) startContext({ type: 'mix', id: mix.id }, mix.tracks)
  }

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    playMix()
  }

  const numberedSubtitle = mix.subtitle.match(/^(.*?)(?:\s+(\d+))$/)
  const thumbnailLabel = numberedSubtitle?.[1] ?? mix.subtitle
  const thumbnailNumber = numberedSubtitle?.[2]?.padStart(2, '0') ?? null
  const mixOrdinal = numberedSubtitle?.[2] ? Number.parseInt(numberedSubtitle[2], 10) : null
  const accent = mixOrdinal && mixOrdinal > 0
    ? DAILY_MIX_ACCENTS[(mixOrdinal - 1) % DAILY_MIX_ACCENTS.length]
    : (mix.color ?? '#16e5dc')

  return (
    <div
      className="group relative w-40 flex-shrink-0 md:w-48"
      onContextMenu={(event) => openMenuAtPointer(event, menuRef)}
    >
      <Link
        to={`/mix/${mix.id}`}
        className={`block rounded-lg transition-colors ${flush ? 'p-3 hover:bg-surface' : 'p-3 hover:bg-surface'}`}
      >
        <div className="relative aspect-square rounded-md overflow-hidden bg-elevated mb-3 shadow-lg">
          {covers.length >= 4 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2">
              {covers.map((url, i) => (
                <img key={i} src={url} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
          ) : covers.length >= 1 ? (
            <img src={covers[0]} alt={mix.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: accent }} />
          )}

          {/* Reference-style split label: title left, zero-padded mix number right. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex items-end justify-between gap-2 px-1">
            <span
              data-testid="daily-mix-thumbnail-label"
              // NOT sm:text-base: `--color-base` in the @theme block turns `.text-base`
              // into a COLOR utility (color: var(--c-base)) that beats text-black, so
              // this label rendered in the page background colour - black in dark mode
              // (which hid it) and near-white #e9edeb in light mode.
              // The `length:` hint is required. Plain `text-[1rem]` is ambiguous between
              // a colour and a size here, and Tailwind silently emits NO rule for it.
              className="rounded-[2px] px-1 py-0.5 text-sm font-black leading-none tracking-[-0.04em] text-black sm:text-[length:1rem]"
              style={{ backgroundColor: accent }}
            >
              {thumbnailLabel}
            </span>
            {thumbnailNumber && (
              <span
                data-testid="daily-mix-thumbnail-number"
                className="flex min-w-[3rem] items-center justify-center rounded-[2px] px-1 text-[1.75rem] font-normal leading-[0.88] text-black sm:min-w-[3.25rem] sm:text-[2rem]"
                style={{ backgroundColor: accent }}
              >
                <span className="inline-block scale-x-[1.2]">{thumbnailNumber}</span>
              </span>
            )}
          </div>

          <CardPlayButton
            onClick={handlePlay}
            isPlaying={isPlayingContext}
            isActive={isActiveContext}
            ariaLabel={isPlayingContext ? `Pause ${mix.title}` : `Play ${mix.title}`}
          />
        </div>
        <p className={`text-sm ${boldTitle ? 'font-semibold' : 'font-normal'} text-primary truncate`}>{mix.title}</p>
        <p className="text-xs text-secondary mt-0.5 truncate">
          {mix.tracks.slice(0, 3).map((t) => t.artist.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
        </p>
      </Link>

      <div className="absolute right-5 top-5 z-20" onClick={(event) => event.stopPropagation()}>
        <MixMenu
          ref={menuRef}
          mix={mix}
          isPlaying={isPlayingContext}
          onPlay={playMix}
          triggerClassName="rounded-full bg-black/65 p-1 text-white shadow-md backdrop-blur-sm"
          triggerIconClassName="h-5 w-5 text-white"
        />
      </div>
    </div>
  )
}
