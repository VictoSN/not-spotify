import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  EllipsisHorizontalIcon,
  PlusIcon,
  MinusCircleIcon,
  QueueListIcon,
  ForwardIcon,
  UserIcon,
  MusicalNoteIcon,
  RadioIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowDownCircleIcon,
  CheckCircleIcon,
  IdentificationIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline'
import { ArrowPathIcon, CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { trackService } from '@/services/trackService'
import { useOfflineTrack } from '@/hooks/useOfflineTrack'
import { usePointerMenu } from '@/hooks/usePointerMenu'
import {
  CONTEXT_MENU_ITEM_CLASS,
  CONTEXT_MENU_PANEL_CLASS,
  type PointerMenuHandle,
} from '@/utils/contextMenu'
import { shareLink } from '@/utils/share'
import { ShareToChatModal } from '@/components/chat/ShareToChatModal'
import { repostService } from '@/services/repostService'
import { notify } from '@/utils/toast'
import { AnimatedLikeIcon } from '@/components/common/AnimatedLikeIcon'
import { ShareIcon } from '@/components/common/ShareIcon'
import { PlaylistCover } from './PlaylistCover'

interface TrackRowMenuProps {
  track: Track
  /** When rendered inside a playlist page, omit this playlist from the "Add to playlist" flyout. */
  currentPlaylistId?: string
  onRemovedFromCurrentPlaylist?: (trackId: string) => void
  /** Always show the trigger button regardless of parent hover state. */
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
  onViewCredits?: () => void
  /** Hide the premium "Download" item — used where a dedicated download button already exists
   *  in the surrounding toolbar (e.g. the track detail page) so it doesn't appear twice. */
  hideDownload?: boolean
  onCopyEmbed?: () => void | Promise<void>
  triggerContent?: ReactNode
  triggerTitle?: string
  openAddSubmenuOnTrigger?: boolean
  /** Where the trigger tooltip pops relative to the button. Use 'bottom' when the
   *  trigger sits at the top edge of a panel so the tooltip isn't covered by the
   *  app header (tooltips can't escape their ancestor stacking context). */
  triggerTooltipPlacement?: 'top' | 'bottom'
}

/** Imperative handle so parents can open the menu at the pointer on right-click. */
export type TrackRowMenuHandle = PointerMenuHandle

export const TrackRowMenu = forwardRef<TrackRowMenuHandle, TrackRowMenuProps>(function TrackRowMenu({
  track,
  currentPlaylistId,
  onRemovedFromCurrentPlaylist,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
  onViewCredits,
  hideDownload,
  onCopyEmbed,
  triggerContent,
  triggerTitle,
  openAddSubmenuOnTrigger,
  triggerTooltipPlacement = 'top',
}, ref) {
  const navigate = useNavigate()
  const [addSubmenuOpen, setAddSubmenuOpen] = useState(false)
  const [removeSubmenuOpen, setRemoveSubmenuOpen] = useState(false)
  const [playlistQuery, setPlaylistQuery] = useState('')
  const [removePlaylistQuery, setRemovePlaylistQuery] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [shareToChatOpen, setShareToChatOpen] = useState(false)
  const [stagedPlaylistIds, setStagedPlaylistIds] = useState<Set<string>>(new Set())
  const [savingPlaylistPicker, setSavingPlaylistPicker] = useState(false)
  // Hover-intent timer: closing the flyout is delayed so the pointer can cross
  // the small gap between the "Add to playlist" row and the flyout without it
  // flickering shut.
  const addCloseTimer = useRef<number | null>(null)
  const removeCloseTimer = useRef<number | null>(null)
  const autoAddedPlaylistIdsRef = useRef<Set<string>>(new Set())
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
  const playlistsWithTrack: typeof myOwnedPlaylists = []

  // Playlists this track has already been added to — include the current playlist so the
  // user can remove the song they're looking at right now.
  // Playlists this track hasn't been added to — exclude the current playlist since it
  // would be a duplicate add.
  const trimmedQuery = playlistQuery.trim().toLowerCase()
  const addPickerPlaylists = myOwnedPlaylists.filter((p) => p.id !== currentPlaylistId)
  const filteredAddPlaylists = [
    ...(trimmedQuery
      ? addPickerPlaylists.filter((p) => p.name.toLowerCase().includes(trimmedQuery))
      : addPickerPlaylists),
  ].sort((a, b) => Number(stagedPlaylistIds.has(b.id)) - Number(stagedPlaylistIds.has(a.id)))
  const filteredRemovePlaylists: typeof myOwnedPlaylists = []

  const openAddSubmenu = () => {
    if (addCloseTimer.current) {
      clearTimeout(addCloseTimer.current)
      addCloseTimer.current = null
    }
    // Lazily ensure the playlist list is hydrated.
    if (savedPlaylists.length === 0) void fetchLibrary()
    setStagedPlaylistIds(currentPlaylistIdsWithTrack())
    setAddSubmenuOpen(true)
  }

  const scheduleCloseAddSubmenu = () => {
    if (addCloseTimer.current) clearTimeout(addCloseTimer.current)
    addCloseTimer.current = window.setTimeout(() => {
      setAddSubmenuOpen(false)
      setPlaylistQuery('')
    }, 120)
  }

  const openRemoveSubmenu = () => {}
  const scheduleCloseRemoveSubmenu = () => {}

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

  const handleAddToPlaylist = async (playlistId: string, options?: { silent?: boolean }) => {
    try {
      await addTrackToPlaylist(playlistId, track)
      if (!options?.silent) notify.success('Added to playlist')
      return true
    } catch (error) {
      // The backend returns 409 when the track is already in the playlist.
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        if (!options?.silent) notify.info('Already in this playlist')
        return true
      }
      if (!options?.silent) notify.error("Couldn't add to playlist")
      return false
    }
  }

  const handleRemoveFromPlaylist = async (playlistId: string) => {
    try {
      await removeTrackFromPlaylist(playlistId, track.id)
      if (playlistId === currentPlaylistId) onRemovedFromCurrentPlaylist?.(track.id)
      notify.success('Removed from playlist')
      return true
    } catch {
      notify.error("Couldn't remove from playlist")
      return false
    }
  }

  const currentPlaylistIdsWithTrack = () =>
    new Set(
      myOwnedPlaylists
        .filter((p) => p.id !== currentPlaylistId && (p.tracks ?? []).some((pt) => pt.track.id === track.id))
        .map((p) => p.id),
    )

  const openPlaylistPicker = () => {
    if (savedPlaylists.length === 0) void fetchLibrary()
    autoAddedPlaylistIdsRef.current.clear()
    setPlaylistQuery('')
    setStagedPlaylistIds(currentPlaylistIdsWithTrack())
  }

  const toggleStagedPlaylist = (playlistId: string) => {
    setStagedPlaylistIds((current) => {
      const next = new Set(current)
      if (next.has(playlistId)) next.delete(playlistId)
      else next.add(playlistId)
      return next
    })
  }

  const applyPlaylistPicker = async () => {
    setSavingPlaylistPicker(true)
    try {
      const before = currentPlaylistIdsWithTrack()
      autoAddedPlaylistIdsRef.current.forEach((playlistId) => before.add(playlistId))
      for (const playlistId of stagedPlaylistIds) {
        if (!before.has(playlistId)) await handleAddToPlaylist(playlistId)
      }
      for (const playlistId of before) {
        if (!stagedPlaylistIds.has(playlistId)) await handleRemoveFromPlaylist(playlistId)
      }
      autoAddedPlaylistIdsRef.current.clear()
    } finally {
      setSavingPlaylistPicker(false)
    }
  }

  const handleNewPlaylistInPicker = async () => {
    setSavingPlaylistPicker(true)
    try {
      const playlist = await createPlaylist(`My Playlist #${savedPlaylists.length + 1}`, undefined, true, undefined, track.album.coverUrl)
      const added = await handleAddToPlaylist(playlist.id, { silent: true })
      if (added) {
        autoAddedPlaylistIdsRef.current.add(playlist.id)
        setStagedPlaylistIds((current) => new Set([...current, playlist.id]))
        notify.success('Playlist created and track added')
      } else {
        notify.error("Playlist created, but couldn't add this track")
      }
    } catch {
      notify.error("Couldn't create playlist")
    } finally {
      setSavingPlaylistPicker(false)
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (msg) notify.error(msg)
      else notify.error("Couldn't repost")
    }
  }

  // Stops the row's onClick (which would otherwise play the track) from firing
  // when the user interacts with anything inside the menu.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const itemClass = CONTEXT_MENU_ITEM_CLASS
  const triggerLabel = triggerTitle ?? 'More options'
  const hasSpotifyTooltip = triggerClassName?.includes('spotify-tooltip-anchor')

  return (
    <Menu>
      {({ close, open }) => {
        menu.sync(open, close)
        return (
        <>
          {/* Visible "…" affordance — a plain button that opens the menu just below it. */}
          <button
            type="button"
            aria-label={triggerLabel}
            title={hasSpotifyTooltip ? undefined : triggerLabel}
            onClick={(e) => {
              stop(e)
              // Reset any leftover submenu state from a previous open.
              setAddSubmenuOpen(false)
              setPlaylistQuery('')
              if (open) close()
              else {
                openFromButton(e)
                if (openAddSubmenuOnTrigger) {
                  if (!isAuthenticated) {
                    openAuthPrompt({
                      title: 'Save songs to playlists with a free account',
                      imageUrl: track.album.coverUrl,
                    })
                  } else openPlaylistPicker()
                }
              }
            }}
            className={`cursor-pointer transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'} ${triggerClassName ?? ''}`}
          >
            {triggerContent ?? (
              <EllipsisHorizontalIcon className={triggerIconClassName ?? 'h-5 w-5 stroke-[2.2] text-secondary hover:text-primary'} />
            )}
            {hasSpotifyTooltip && (
              <span className={`spotify-tooltip spotify-tooltip-${triggerTooltipPlacement} spotify-tooltip-center`}>{triggerLabel}</span>
            )}
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
            className={openAddSubmenuOnTrigger
              ? 'z-[1000] flex max-h-[32rem] w-80 origin-top flex-col overflow-hidden rounded-md bg-elevated text-sm font-normal leading-5 shadow-2xl ring-1 ring-primary/10 focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0'
              : CONTEXT_MENU_PANEL_CLASS}
          >
            {openAddSubmenuOnTrigger ? (
              <>
                <div className="px-3 pb-2 pt-3 text-xs font-bold text-secondary">Add to playlist</div>
                <div className="px-2 pb-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                    <input
                      type="text"
                      value={playlistQuery}
                      onChange={(e) => setPlaylistQuery(e.target.value)}
                      onClick={stop}
                      onMouseDown={stop}
                      onPointerDown={stop}
                      placeholder="Find a playlist"
                      className="h-9 w-full rounded-md bg-surface pl-8 pr-3 text-sm font-semibold text-primary outline-none placeholder:text-secondary focus:ring-1 focus:ring-accent/50"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingPlaylistPicker}
                  onClick={async (e) => {
                    stop(e)
                    await handleNewPlaylistInPicker()
                  }}
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-base font-bold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlusIcon className="h-5 w-5" />
                  New playlist
                </button>
                <div className="mx-4 h-px bg-secondary/20" />
                <div className="min-h-0 flex-1 overflow-y-auto py-1">
                  {filteredAddPlaylists.map((p) => {
                    const selected = stagedPlaylistIds.has(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          stop(e)
                          toggleStagedPlaylist(p.id)
                        }}
                        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left text-base font-bold text-primary transition-colors hover:bg-primary/10"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded">
                            <PlaylistCover coverUrl={p.coverUrl} tracks={p.tracks} name={p.name} />
                          </div>
                          <span className="truncate">{p.name}</span>
                        </span>
                        {selected ? (
                          <CheckCircleSolidIcon className="h-5 w-5 shrink-0 text-accent" />
                        ) : (
                          <span className="h-5 w-5 shrink-0 rounded-full border border-secondary/70" />
                        )}
                      </button>
                    )
                  })}
                  {filteredAddPlaylists.length === 0 && (
                    <p className="px-4 py-5 text-sm text-secondary">
                      {trimmedQuery ? 'No matches.' : 'No playlists yet.'}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 bg-elevated px-4 py-3 shadow-[0_-18px_30px_rgba(0,0,0,0.18)]">
                  <button
                    type="button"
                    disabled={savingPlaylistPicker}
                    onClick={(e) => {
                      stop(e)
                      setPlaylistQuery('')
                      setStagedPlaylistIds(currentPlaylistIdsWithTrack())
                      close()
                    }}
                    className="rounded-full px-4 py-2 text-sm font-bold text-secondary transition-colors hover:text-primary disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingPlaylistPicker}
                    onClick={async (e) => {
                      stop(e)
                      await applyPlaylistPicker()
                      setPlaylistQuery('')
                      close()
                    }}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-base transition-transform hover:scale-105 disabled:opacity-60"
                  >
                    {savingPlaylistPicker ? 'Saving...' : 'Done'}
                  </button>
                </div>
              </>
            ) : (
              <>
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
                className={`${itemClass} justify-between`}
              >
                <span className="flex items-center gap-3">
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
                  className={isMobile
                    ? 'flex max-h-96 w-full flex-col overflow-hidden bg-elevated/80 border-t border-secondary/10 py-1'
                    : 'absolute right-full top-0 mr-1 flex max-h-[32rem] w-80 flex-col overflow-hidden rounded-md bg-elevated shadow-2xl ring-1 ring-primary/10 py-1'}
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
                    disabled={savingPlaylistPicker}
                    onClick={async (e) => {
                      stop(e)
                      await handleNewPlaylistInPicker()
                    }}
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-base font-bold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PlusIcon className="h-5 w-5" />
                    New playlist
                  </button>

                  {filteredAddPlaylists.length > 0 && <div className="my-1 h-px bg-secondary/20" />}

                  <div className="min-h-0 flex-1 overflow-y-auto">
                  {filteredAddPlaylists.map((p) => {
                    const selected = stagedPlaylistIds.has(p.id)
                    return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        stop(e)
                        toggleStagedPlaylist(p.id)
                      }}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left text-base font-bold text-primary transition-colors hover:bg-primary/10"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded">
                        <PlaylistCover coverUrl={p.coverUrl} tracks={p.tracks} name={p.name} />
                      </div>
                      <span className="truncate">{p.name}</span>
                      </span>
                      {selected ? (
                        <CheckCircleSolidIcon className="h-5 w-5 shrink-0 text-accent" />
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full border border-secondary/70" />
                      )}
                    </button>
                    )
                  })}

                  {filteredAddPlaylists.length === 0 && (
                    <p className="px-3 py-2 text-xs text-secondary">
                      {trimmedQuery ? 'No matches.' : 'No playlists yet.'}
                    </p>
                  )}
                  </div>
                  <div className="flex items-center justify-end gap-3 bg-elevated px-4 py-3 shadow-[0_-18px_30px_rgba(0,0,0,0.18)]">
                    <button
                      type="button"
                      disabled={savingPlaylistPicker}
                      onClick={(e) => {
                        stop(e)
                        setAddSubmenuOpen(false)
                        setPlaylistQuery('')
                        setStagedPlaylistIds(currentPlaylistIdsWithTrack())
                        close()
                      }}
                      className="rounded-full px-4 py-2 text-sm font-bold text-secondary transition-colors hover:text-primary disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingPlaylistPicker}
                      onClick={async (e) => {
                        stop(e)
                        await applyPlaylistPicker()
                        setAddSubmenuOpen(false)
                        setPlaylistQuery('')
                        close()
                      }}
                      className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-base transition-transform hover:scale-105 disabled:opacity-60"
                    >
                      {savingPlaylistPicker ? 'Saving...' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isAuthenticated && currentPlaylistId && (
              <MenuItem>
                <button
                  type="button"
                  onClick={async (event) => {
                    stop(event)
                    if (await handleRemoveFromPlaylist(currentPlaylistId)) close()
                  }}
                  className={itemClass}
                >
                  <MinusCircleIcon className="h-4 w-4" />
                  Remove from this playlist
                </button>
              </MenuItem>
            )}

            {/* Other owned playlists containing this track keep the removable flyout. */}
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
                  className={`${itemClass} justify-between`}
                >
                  <span className="flex items-center gap-3">
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
                        className={itemClass}
                      >
                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded">
                        <PlaylistCover coverUrl={p.coverUrl} tracks={p.tracks} name={p.name} />
                      </div>
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
                className={itemClass}
              >
                <AnimatedLikeIcon liked={isLiked} className="w-4 h-4" heartClassName="w-4 h-4" />
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
                    className={itemClass}
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
                    className={itemClass}
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
                className={itemClass}
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
                className={itemClass}
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
                className={itemClass}
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
                  className={itemClass}
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
                  className={itemClass}
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
                  className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left font-normal text-secondary transition-colors hover:bg-primary/10 data-[focus]:bg-primary/10"
                >
                  <span className="flex items-center gap-3">
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Download
                  </span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-accent">Premium</span>
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
                  className={itemClass}
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
                  className={itemClass}
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
                  className={itemClass}
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Repost
                </button>
              </MenuItem>
            )}

            {onCopyEmbed && (
              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    void onCopyEmbed()
                    close()
                  }}
                  className={itemClass}
                >
                  <CodeBracketIcon className="w-4 h-4" />
                  Copy embed code
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
                className={itemClass}
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            </MenuItem>
              </>
            )}
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
