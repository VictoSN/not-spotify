import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  EllipsisHorizontalIcon,
  PlusIcon,
  HeartIcon as HeartOutlineIcon,
  QueueListIcon,
  UserIcon,
  MusicalNoteIcon,
  ShareIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'

interface TrackRowMenuProps {
  track: Track
  /** When rendered inside a playlist page, omit this playlist from the "Add to playlist" flyout. */
  currentPlaylistId?: string
}

export function TrackRowMenu({ track, currentPlaylistId }: TrackRowMenuProps) {
  const navigate = useNavigate()
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [playlistQuery, setPlaylistQuery] = useState('')
  // Hover-intent timer: closing the flyout is delayed so the pointer can cross
  // the small gap between the "Add to playlist" row and the flyout without it
  // flickering shut.
  const closeTimer = useRef<number | null>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const likedTrackIds = useLibraryStore((s) => s.likedTrackIds)
  const likeTrack = useLibraryStore((s) => s.likeTrack)
  const unlikeTrack = useLibraryStore((s) => s.unlikeTrack)
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist)
  const createPlaylist = useLibraryStore((s) => s.createPlaylist)
  const fetchLibrary = useLibraryStore((s) => s.fetchLibrary)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  const isLiked = likedTrackIds.has(track.id)
  const myPlaylists = savedPlaylists.filter((p) => p.isOwner && p.id !== currentPlaylistId)
  const trimmedQuery = playlistQuery.trim().toLowerCase()
  const filteredPlaylists = trimmedQuery
    ? myPlaylists.filter((p) => p.name.toLowerCase().includes(trimmedQuery))
    : myPlaylists

  const openSubmenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    // Lazily ensure the playlist list is hydrated.
    if (savedPlaylists.length === 0) void fetchLibrary()
    setSubmenuOpen(true)
  }

  const scheduleCloseSubmenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setSubmenuOpen(false)
      setPlaylistQuery('')
    }, 120)
  }

  // Clear any pending close timer if the menu unmounts.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
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

  const handleAddToPlaylist = async (playlistId: string) => {
    // The `/me/playlists` summary doesn't include the tracks array, so we can't
    // pre-detect duplicates here. The backend returns 409 on duplicate; we catch
    // and swallow it silently so a double-click is a no-op rather than a crash.
    try {
      await addTrackToPlaylist(playlistId, track)
    } catch {
      // ignore duplicate / network blips
    }
  }

  const handleNewPlaylist = async () => {
    const playlist = await createPlaylist('My Playlist', undefined, true)
    await addTrackToPlaylist(playlist.id, track)
    navigate(`/playlist/${playlist.id}`)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/album/${track.album.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* ignore — clipboard may be unavailable */
    }
  }

  // Stops the row's onClick (which would otherwise play the track) from firing
  // when the user interacts with anything inside the menu.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <Menu>
      {({ close }) => (
        <>
          <MenuButton
            onClick={(e) => {
              stop(e)
              // Reset any leftover submenu state from a previous open.
              setSubmenuOpen(false)
              setPlaylistQuery('')
            }}
            aria-label="More options"
            className="cursor-pointer opacity-0 group-hover:opacity-100 data-[open]:opacity-100 transition-opacity"
          >
            <EllipsisHorizontalIcon className="w-4 h-4 text-secondary hover:text-primary" />
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            modal={false}
            onClick={stop}
            // `overflow-visible!` overrides the inline `overflow: auto` that
            // Headless UI's `anchor` adds for edge-scrolling — without it the
            // anchored panel clips the "Add to playlist" flyout, which sits
            // outside the panel box (positioned `right-full`, to its left).
            className="z-50 w-60 overflow-visible! rounded-md bg-elevated shadow-2xl ring-1 ring-black/20 py-1 text-sm focus:outline-none"
          >
            {/*
              "Add to playlist" — intentionally NOT a MenuItem. Headless UI's
              MenuItem auto-closes the parent Menu on click and manages focus
              in ways that fight an inline flyout. A plain div sidesteps all of
              that; we lose ↑/↓ keyboard nav onto this single row but Tab still
              reaches it and the trigger stays a real <button>.
            */}
            <div
              className="relative"
              onMouseDown={stop}
              onPointerDown={stop}
              onMouseEnter={() => {
                if (isAuthenticated) openSubmenu()
              }}
              onMouseLeave={scheduleCloseSubmenu}
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
                  openSubmenu()
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-primary hover:bg-surface"
              >
                <span className="flex items-center gap-2">
                  <PlusIcon className="w-4 h-4" />
                  Add to playlist
                </span>
                <ChevronRightIcon className="w-4 h-4 text-secondary" />
              </button>

              {submenuOpen && isAuthenticated && (
                <div
                  onClick={stop}
                  onMouseDown={stop}
                  onPointerDown={stop}
                  className="absolute right-full top-0 mr-1 w-72 max-h-96 overflow-y-auto rounded-md bg-elevated shadow-2xl ring-1 ring-black/20 py-1"
                >
                  {/* "Find a playlist" search */}
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
                      setSubmenuOpen(false)
                      setPlaylistQuery('')
                      close()
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface"
                  >
                    <PlusIcon className="w-4 h-4" />
                    New playlist
                  </button>

                  {filteredPlaylists.length > 0 && <div className="my-1 h-px bg-secondary/20" />}

                  {filteredPlaylists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={async (e) => {
                        stop(e)
                        await handleAddToPlaylist(p.id)
                        setSubmenuOpen(false)
                        setPlaylistQuery('')
                        close()
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface"
                    >
                      {p.coverUrl ? (
                        <img src={p.coverUrl} alt={p.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-surface flex items-center justify-center text-[10px]">🎵</div>
                      )}
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}

                  {filteredPlaylists.length === 0 && (
                    <p className="px-3 py-2 text-xs text-secondary">
                      {trimmedQuery ? 'No matches.' : 'No playlists yet.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  handleToggleLike()
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                {isLiked ? (
                  <HeartSolidIcon className="w-4 h-4 text-accent" />
                ) : (
                  <HeartOutlineIcon className="w-4 h-4" />
                )}
                {isLiked ? 'Remove from your Liked Songs' : 'Save to your Liked Songs'}
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <QueueListIcon className="w-4 h-4" />
                Add to queue
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <MusicalNoteIcon className="w-4 h-4" />
                Go to album
              </button>
            </MenuItem>

            <div className="my-1 h-px bg-secondary/20" />

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  void handleShare()
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-primary hover:bg-surface data-[focus]:bg-surface"
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            </MenuItem>
          </MenuItems>
        </>
      )}
    </Menu>
  )
}
