import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  EllipsisHorizontalIcon,
  PlusIcon,
  MinusCircleIcon,
  HeartIcon as HeartOutlineIcon,
  QueueListIcon,
  ForwardIcon,
  UserIcon,
  MusicalNoteIcon,
  RadioIcon,
  ShareIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowDownCircleIcon,
  CheckCircleIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { trackService } from '@/services/trackService'
import { useOfflineTrack } from '@/hooks/useOfflineTrack'
import { usePointerMenu } from '@/hooks/usePointerMenu'
import type { PointerMenuHandle } from '@/utils/contextMenu'
import { shareLink } from '@/utils/share'
import { ShareToChatModal } from '@/components/chat/ShareToChatModal'
import { repostService } from '@/services/repostService'
import { notify } from '@/utils/toast'

interface TrackRowMenuProps {
  track: Track
  /** When rendered inside a playlist page, omit this playlist from the "Add to playlist" flyout. */
  currentPlaylistId?: string
  /** Always show the trigger button regardless of parent hover state. */
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
  onViewCredits?: () => void
  /** Hide the premium "Download" item — used where a dedicated download button already exists
   *  in the surrounding toolbar (e.g. the track detail page) so it doesn't appear twice. */
  hideDownload?: boolean
}

/** Imperative handle so parents can open the menu at the pointer on right-click. */
export type TrackRowMenuHandle = PointerMenuHandle

export const TrackRowMenu = forwardRef<TrackRowMenuHandle, TrackRowMenuProps>(function TrackRowMenu({
  track,
  currentPlaylistId,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
  onViewCredits,
  hideDownload,
}, ref) {
  const navigate = useNavigate()
  const [addSubmenuOpen, setAddSubmenuOpen] = useState(false)
  const [removeSubmenuOpen, setRemoveSubmenuOpen] = useState(false)
  const [playlistQuery, setPlaylistQuery] = useState('')
  const [removePlaylistQuery, setRemovePlaylistQuery] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [shareToChatOpen, setShareToChatOpen] = useState(false)
  // Hover-intent timer: closing the flyout is delayed so the pointer can cross
  // the small gap between the "Add to playlist" row and the flyout without it
  // flickering shut.
  const addCloseTimer = useRef<number | null>(null)
  const removeCloseTimer = useRef<number | null>(null)
  const isMobile = useIsMobile()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isPremium = useAuthStore((s) => s.user?.plan === 'premium')
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const likedTrackIds = useLibraryStore((s) => s.likedTrackIds)
  const likeTrack = useLibraryStore((s) => s.likeTrack)
  const unlikeTrack = useLibraryStore((s) => s.unlikeTrack)
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist)
  const createPlaylist = useLibraryStore((s) => s.createPlaylist)
  const fetchLibrary = useLibraryStore((s) => s.fetchLibrary)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const playNext = usePlayerStore((s) => s.playNext)
  const play = usePlayerStore((s) => s.play)
  const queue = usePlayerStore((s) => s.queue)
  const offline = useOfflineTrack(track)

  // Pointer-anchored open/close/reopen behaviour shared with every other menu.
  const menu = usePointerMenu()
  const { coords, hiddenBtnRef, openAt, openFromButton } = menu
  useImperativeHandle(ref, () => ({ openAt }), [openAt])

  const isLiked = likedTrackIds.has(track.id)
  const isInQueue = queue.some((t) => t.id === track.id)
  const myOwnedPlaylists = savedPlaylists.filter((p) => p.isOwner)

  // Playlists this track has already been added to — include the current playlist so the
  // user can remove the song they're looking at right now.
  const playlistsWithTrack = myOwnedPlaylists.filter((p) =>
    (p.tracks ?? []).some((pt) => pt.track.id === track.id),
  )
  // Playlists this track hasn't been added to — exclude the current playlist since it
  // would be a duplicate add.
  const playlistsWithoutTrack = myOwnedPlaylists.filter(
    (p) => p.id !== currentPlaylistId && !(p.tracks ?? []).some((pt) => pt.track.id === track.id),
  )

  const trimmedQuery = playlistQuery.trim().toLowerCase()
  const filteredAddPlaylists = trimmedQuery
    ? playlistsWithoutTrack.filter((p) => p.name.toLowerCase().includes(trimmedQuery))
    : playlistsWithoutTrack

  const trimmedRemoveQuery = removePlaylistQuery.trim().toLowerCase()
  const filteredRemovePlaylists = trimmedRemoveQuery
    ? playlistsWithTrack.filter((p) => p.name.toLowerCase().includes(trimmedRemoveQuery))
    : playlistsWithTrack

  const openAddSubmenu = () => {
    if (addCloseTimer.current) {
      clearTimeout(addCloseTimer.current)
      addCloseTimer.current = null
    }
    // Lazily ensure the playlist list is hydrated.
    if (savedPlaylists.length === 0) void fetchLibrary()
    setAddSubmenuOpen(true)
    setRemoveSubmenuOpen(false)
  }

  const scheduleCloseAddSubmenu = () => {
    if (addCloseTimer.current) clearTimeout(addCloseTimer.current)
    addCloseTimer.current = window.setTimeout(() => {
      setAddSubmenuOpen(false)
      setPlaylistQuery('')
    }, 120)
  }

  const openRemoveSubmenu = () => {
    if (removeCloseTimer.current) {
      clearTimeout(removeCloseTimer.current)
      removeCloseTimer.current = null
    }
    if (savedPlaylists.length === 0) void fetchLibrary()
    setRemoveSubmenuOpen(true)
    setAddSubmenuOpen(false)
  }

  const scheduleCloseRemoveSubmenu = () => {
    if (removeCloseTimer.current) clearTimeout(removeCloseTimer.current)
    removeCloseTimer.current = window.setTimeout(() => {
      setRemoveSubmenuOpen(false)
      setRemovePlaylistQuery('')
    }, 120)
  }

  // Clear any pending close timers if the menu unmounts.
  useEffect(() => () => {
    if (addCloseTimer.current) clearTimeout(addCloseTimer.current)
    if (removeCloseTimer.current) clearTimeout(removeCloseTimer.current)
  }, [])

  // Re-used auth-gate that opens the existing modal with a contextual title.
  const gate = (title: string, action: () => void | Promise<void>): void => {
    if (!isAuthenticated) {
      openAuthPrompt({ title, imageUrl: track.album.coverUrl })
      return
    }
    void action()
  }

  const handleToggleLike = () =>
    gate('Like songs with a free account', () => {
      if (isLiked) unlikeTrack(track.id)
      else likeTrack(track)
    })

  const handleAddToQueue = () =>
    gate('Add to queue with a free account', () => addToQueue(track))

  const handlePlayNext = () =>
    gate('Queue songs with a free account', () => playNext(track))

  const handleStartRadio = () =>
    gate('Start a radio station with a free account', async () => {
      try {
        const station = await trackService.getRadio(track.id, 40)
        if (station.length > 0) play(station[0], station)
      } catch {
        // Fall back to just playing the seed track if radio can't be built.
        play(track, [track])
      }
    })

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      await addTrackToPlaylist(playlistId, track)
      notify.success('Added to playlist')
    } catch (error) {
      // The backend returns 409 when the track is already in the playlist.
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) notify.info('Already in this playlist')
      else notify.error("Couldn't add to playlist")
    }
  }

  const handleRemoveFromPlaylist = async (playlistId: string) => {
    try {
      await removeTrackFromPlaylist(playlistId, track.id)
      notify.success('Removed from playlist')
    } catch {
      notify.error("Couldn't remove from playlist")
    }
  }

  const handleNewPlaylist = async () => {
    try {
      const playlist = await createPlaylist(`My Playlist #${savedPlaylists.length + 1}`, undefined, true)
      await addTrackToPlaylist(playlist.id, track)
      navigate(`/playlist/${playlist.id}`)
    } catch {
      notify.error("Couldn't create playlist")
    }
  }

  const handleShare = async () => {
    const result = await shareLink(`/track/${track.id}`, {
      title: track.title,
      text: `${track.title} · ${track.artist.name}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
    // 'shared' → the native share sheet already gave feedback.
  }

  const handleRepost = async () => {
    try {
      await repostService.createRepost({ trackId: track.id })
      notify.success('Reposted to your followers')
    } catch (err: any) {
      const msg = err?.response?.data?.message
      if (msg) notify.error(msg)
      else notify.error("Couldn't repost")
    }
  }

  // Stops the row's onClick (which would otherwise play the track) from firing
  // when the user interacts with anything inside the menu.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <Menu>
      {({ close, open }) => {
        menu.sync(open, close)
        return (
        <>
          {/* Visible "…" affordance — a plain button that opens the menu just below it. */}
          <button
            type="button"
            aria-label="More options"
            onClick={(e) => {
              stop(e)
              // Reset any leftover submenu state from a previous open.
              setAddSubmenuOpen(false)
              setRemoveSubmenuOpen(false)
              setPlaylistQuery('')
              setRemovePlaylistQuery('')
              if (open) close()
              else openFromButton(e)
            }}
            className={`cursor-pointer transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'} ${triggerClassName ?? ''}`}
          >
            <EllipsisHorizontalIcon className={triggerIconClassName ?? 'h-5 w-5 stroke-[2.2] text-secondary hover:text-primary'} />
          </button>
          {/* Real Headless UI trigger: invisible, portaled to <body>, parked at the
              pointer so the menu spawns exactly there (immune to transformed ancestors). */}
          {createPortal(
            <MenuButton
              ref={hiddenBtnRef}
              aria-hidden
              tabIndex={-1}
              className="fixed h-0 w-0 p-0 opacity-0 pointer-events-none"
              style={{ left: coords.x, top: coords.y }}
            />,
            document.body,
          )}
          <MenuItems
            anchor="bottom start"
            modal={false}
            transition
            onClick={stop}
            // `overflow-visible!` overrides the inline `overflow: auto` that
            // Headless UI's `anchor` adds for edge-scrolling — without it the
            // anchored panel clips the "Add to playlist" flyout, which sits
            // outside the panel box (positioned `right-full`, to its left).
            className="z-50 w-56 origin-top overflow-visible! rounded-md bg-elevated shadow-2xl ring-1 ring-black/20 py-1 text-[13px] font-bold focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            {/*
              "Add to playlist" — intentionally NOT a MenuItem. Headless UI's
              MenuItem auto-closes the parent Menu on click and manages focus
              in ways that fight an inline flyout. A plain div sidesteps all of
              that; we lose ↑/↓ keyboard nav onto this single row but Tab still
              reaches it and the trigger stays a real <button>.
            */}
            {/* Add to playlist */}
            <div
              className="relative"
              onMouseDown={stop}
              onPointerDown={stop}
              onMouseEnter={() => {
                if (isAuthenticated) openAddSubmenu()
              }}
              onMouseLeave={scheduleCloseAddSubmenu}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isAuthenticated) {
                    openAuthPrompt({
                      title: 'Save songs to playlists with a free account',
                      imageUrl: track.album.coverUrl,
                    })
                    close()
                    return
                  }
                  openAddSubmenu()
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface"
              >
                <span className="flex items-center gap-2">
                  <PlusIcon className="w-4 h-4" />
                  Add to playlist
                </span>
                <ChevronRightIcon className="w-4 h-4 text-secondary" />
              </button>

              {addSubmenuOpen && isAuthenticated && (
                <div
                  onClick={stop}
                  onMouseDown={stop}
                  onPointerDown={stop}
                  onMouseEnter={() => {
                    if (addCloseTimer.current) {
                      clearTimeout(addCloseTimer.current)
                      addCloseTimer.current = null
                    }
                  }}
                  onMouseLeave={scheduleCloseAddSubmenu}
                  className={isMobile
                    ? 'w-full max-h-60 overflow-y-auto bg-elevated/80 border-t border-secondary/10 py-1'
                    : 'absolute right-full top-0 mr-1 w-72 max-h-96 overflow-y-auto rounded-md bg-elevated shadow-2xl ring-1 ring-black/20 py-1'}
                >
                  <div className="px-2 pt-1 pb-2">
                    <div className="relative">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                      <input
                        type="text"
                        value={playlistQuery}
                        onChange={(e) => setPlaylistQuery(e.target.value)}
                        onClick={stop}
                        onMouseDown={stop}
                        onPointerDown={stop}
                        placeholder="Find a playlist"
                        className="w-full h-9 rounded-md bg-surface text-sm text-primary placeholder:text-muted pl-8 pr-3 outline-none focus:ring-1 focus:ring-accent/50"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async (e) => {
                      stop(e)
                      await handleNewPlaylist()
                      setAddSubmenuOpen(false)
                      setPlaylistQuery('')
                      close()
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface"
                  >
                    <PlusIcon className="w-4 h-4" />
                    New playlist
                  </button>

                  {filteredAddPlaylists.length > 0 && <div className="my-1 h-px bg-secondary/20" />}

                  {filteredAddPlaylists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={async (e) => {
                        stop(e)
                        await handleAddToPlaylist(p.id)
                        setAddSubmenuOpen(false)
                        setPlaylistQuery('')
                        close()
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface"
                    >
                      {p.coverUrl ? (
                        <img src={p.coverUrl} alt={p.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-surface flex items-center justify-center text-[10px]">🎵</div>
                      )}
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}

                  {filteredAddPlaylists.length === 0 && (
                    <p className="px-3 py-2 text-xs text-secondary">
                      {trimmedQuery ? 'No matches.' : 'No playlists yet.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Remove from playlist — only shown when the track is in at least one owned playlist */}
            {isAuthenticated && playlistsWithTrack.length > 0 && (
              <div
                className="relative"
                onMouseDown={stop}
                onPointerDown={stop}
                onMouseEnter={openRemoveSubmenu}
                onMouseLeave={scheduleCloseRemoveSubmenu}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openRemoveSubmenu()
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface"
                >
                  <span className="flex items-center gap-2">
                    <MinusCircleIcon className="w-4 h-4" />
                    Remove from playlist
                  </span>
                  <ChevronRightIcon className="w-4 h-4 text-secondary" />
                </button>

                {removeSubmenuOpen && (
                  <div
                    onClick={stop}
                    onMouseDown={stop}
                    onPointerDown={stop}
                    onMouseEnter={() => {
                      if (removeCloseTimer.current) {
                        clearTimeout(removeCloseTimer.current)
                        removeCloseTimer.current = null
                      }
                    }}
                    onMouseLeave={scheduleCloseRemoveSubmenu}
                    className={isMobile
                      ? 'w-full max-h-60 overflow-y-auto bg-elevated/80 border-t border-secondary/10 py-1'
                      : 'absolute right-full top-0 mr-1 w-72 max-h-96 overflow-y-auto rounded-md bg-elevated shadow-2xl ring-1 ring-black/20 py-1'}
                  >
                    <div className="px-2 pt-1 pb-2">
                      <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                        <input
                          type="text"
                          value={removePlaylistQuery}
                          onChange={(e) => setRemovePlaylistQuery(e.target.value)}
                          onClick={stop}
                          onMouseDown={stop}
                          onPointerDown={stop}
                          placeholder="Find a playlist"
                          className="w-full h-9 rounded-md bg-surface text-sm text-primary placeholder:text-muted pl-8 pr-3 outline-none focus:ring-1 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    {filteredRemovePlaylists.length > 0 && <div className="my-1 h-px bg-secondary/20" />}

                    {filteredRemovePlaylists.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={async (e) => {
                          stop(e)
                          await handleRemoveFromPlaylist(p.id)
                          setRemoveSubmenuOpen(false)
                          setRemovePlaylistQuery('')
                          close()
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface"
                      >
                        {p.coverUrl ? (
                          <img src={p.coverUrl} alt={p.name} className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-surface flex items-center justify-center text-[10px]">🎵</div>
                        )}
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}

                    {filteredRemovePlaylists.length === 0 && (
                      <p className="px-3 py-2 text-xs text-secondary">No matches.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  handleToggleLike()
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                {isLiked ? (
                  <HeartSolidIcon className="w-4 h-4 text-accent" />
                ) : (
                  <HeartOutlineIcon className="w-4 h-4" />
                )}
                {isLiked ? 'Remove from your Liked Songs' : 'Save to your Liked Songs'}
              </button>
            </MenuItem>

            {!isInQueue && (
              <>
                <MenuItem>
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e)
                      handlePlayNext()
                      close()
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
                  >
                    <ForwardIcon className="w-4 h-4" />
                    Play next
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e)
                      handleAddToQueue()
                      close()
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
                  >
                    <QueueListIcon className="w-4 h-4" />
                    Add to queue
                  </button>
                </MenuItem>
              </>
            )}

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  handleStartRadio()
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <RadioIcon className="w-4 h-4" />
                Go to song radio
              </button>
            </MenuItem>

            <div className="my-1 h-px bg-secondary/20" />

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  navigate(`/artist/${track.artist.id}`)
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <UserIcon className="w-4 h-4" />
                Go to artist
              </button>
            </MenuItem>

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  navigate(`/album/${track.album.id}`)
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <MusicalNoteIcon className="w-4 h-4" />
                Go to album
              </button>
            </MenuItem>

            {onViewCredits && (
              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    onViewCredits()
                    close()
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
                >
                  <IdentificationIcon className="w-4 h-4" />
                  View credits
                </button>
              </MenuItem>
            )}

            <div className="my-1 h-px bg-secondary/20" />

            {isPremium ? (
              hideDownload ? null : (
              <MenuItem>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={async (e) => {
                    stop(e)
                    setDownloading(true)
                    try {
                      await trackService.download(track.id, track.title)
                      notify.success('Download started')
                      close()
                    } catch (error) {
                      notify.error(error instanceof Error ? error.message : 'Could not download this track.')
                    } finally {
                      setDownloading(false)
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
                >
                  {downloading
                    ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    : <ArrowDownTrayIcon className="w-4 h-4" />}
                  {downloading ? 'Downloading…' : 'Download'}
                </button>
              </MenuItem>
              )
            ) : (
              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => { stop(e); navigate('/premium'); close() }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-secondary hover:bg-surface data-[focus]:bg-surface"
                >
                  <span className="flex items-center gap-2">
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Download
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-accent/20 text-accent px-1.5 py-0.5 rounded">Premium</span>
                </button>
              </MenuItem>
            )}

            {isPremium && offline.supported && (
              <MenuItem>
                <button
                  type="button"
                  disabled={offline.busy}
                  onClick={(e) => {
                    stop(e)
                    void offline.toggle()
                    // Keep the menu open so the user sees the state change /
                    // any error without re-opening.
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface disabled:cursor-default disabled:opacity-70"
                >
                  {offline.busy ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin text-accent" />
                  ) : offline.saved ? (
                    <CheckCircleIcon className="w-4 h-4 text-accent" />
                  ) : (
                    <ArrowDownCircleIcon className="w-4 h-4" />
                  )}
                  <span>
                    {offline.busy
                      ? offline.saved
                        ? 'Removing…'
                        : 'Downloading…'
                      : offline.saved
                        ? 'Downloaded — remove'
                        : 'Save for offline'}
                  </span>
                </button>
              </MenuItem>
            )}

            {isAuthenticated && (
              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    setShareToChatOpen(true)
                    close()
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  Share to chat
                </button>
              </MenuItem>
            )}

            {isAuthenticated && (
              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    void handleRepost()
                    close()
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Repost
                </button>
              </MenuItem>
            )}

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  void handleShare()
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            </MenuItem>
          </MenuItems>

          {shareToChatOpen && (
            <ShareToChatModal track={track} onClose={() => setShareToChatOpen(false)} />
          )}
        </>
        )
      }}
    </Menu>
  )
})
