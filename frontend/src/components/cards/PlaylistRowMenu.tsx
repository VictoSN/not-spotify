import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  QueueListIcon,
  MinusCircleIcon,
  PencilIcon,
  MusicalNoteIcon,
  FolderPlusIcon,
  FolderIcon,
  LockClosedIcon,
  LockOpenIcon,
  UserPlusIcon,
  ChevronRightIcon,
  CheckIcon,
  UserCircleIcon,
  XCircleIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import type { Playlist } from '@/types/playlist'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { isPinned, togglePinned, PINNED_EVENT } from '@/utils/pinnedLibrary'
import {
  type LibraryFolder,
  getFolders,
  createFolder,
  addItemToFolder,
  folderOfItem,
  FOLDERS_EVENT,
} from '@/utils/libraryFolders'
import { usePointerMenu } from '@/hooks/usePointerMenu'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import { InviteCollaboratorModal } from '@/components/friends/InviteCollaboratorModal'
import { ShareIcon } from '@/components/common/ShareIcon'
import {
  CONTEXT_MENU_ITEM_CLASS,
  CONTEXT_MENU_PANEL_CLASS,
  type PointerMenuHandle,
} from '@/utils/contextMenu'

interface PlaylistRowMenuProps {
  playlist: Playlist
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
  onEditDetails?: () => void
  onAddSongs?: () => void
  onExport?: () => void
  onDelete?: () => void | Promise<void>
}

export type PlaylistRowMenuHandle = PointerMenuHandle

/**
 * Spotify-style right-click menu for a library playlist row. Reuses the same
 * pointer-anchored open mechanism as {@link TrackRowMenu}: an invisible Headless
 * UI trigger is portaled to <body>, parked under the cursor, then clicked — so
 * the menu spawns exactly at the pointer and stays inside the viewport (Headless
 * UI's `anchor` flips it at edges). Click-outside / Esc close are handled by
 * Headless UI's Menu.
 */
export const PlaylistRowMenu = forwardRef<PlaylistRowMenuHandle, PlaylistRowMenuProps>(
  function PlaylistRowMenu({
    playlist,
    alwaysVisible,
    triggerClassName,
    triggerIconClassName,
    onEditDetails,
    onAddSongs,
    onExport,
    onDelete,
  }, ref) {
    const navigate = useNavigate()
    const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
    const savePlaylist = useLibraryStore((s) => s.savePlaylist)
    const unsavePlaylist = useLibraryStore((s) => s.unsavePlaylist)
    const deletePlaylist = useLibraryStore((s) => s.deletePlaylist)
    const createPlaylist = useLibraryStore((s) => s.createPlaylist)
    const setPlaylistVisibility = useLibraryStore((s) => s.setPlaylistVisibility)
    const addToQueue = usePlayerStore((s) => s.addToQueue)

    // Self-contained pin/folder state so the menu works wherever a playlist is
    // shown (sidebar rows AND home/middle cards) — keyed by the shared LibItem key.
    const itemKey = `pl-${playlist.id}`
    const [pinned, setPinned] = useState(() => isPinned(itemKey))
    const [folders, setFolders] = useState<LibraryFolder[]>(getFolders)
    useEffect(() => {
      const syncPinned = () => setPinned(isPinned(itemKey))
      const syncFolders = () => setFolders(getFolders())
      window.addEventListener(PINNED_EVENT, syncPinned)
      window.addEventListener(FOLDERS_EVENT, syncFolders)
      window.addEventListener('storage', syncPinned)
      window.addEventListener('storage', syncFolders)
      return () => {
        window.removeEventListener(PINNED_EVENT, syncPinned)
        window.removeEventListener(FOLDERS_EVENT, syncFolders)
        window.removeEventListener('storage', syncPinned)
        window.removeEventListener('storage', syncFolders)
      }
    }, [itemKey])

    const [folderSubmenuOpen, setFolderSubmenuOpen] = useState(false)
    const [inviteOpen, setInviteOpen] = useState(false)
    const folderCloseTimer = useRef<number | null>(null)

    const isOwner = playlist.isOwner !== false
    // Folder/pin organisation only makes sense for playlists already in the
    // user's library (owned or saved). For a stranger's playlist on a browse
    // page we offer "Add to profile" instead, and hide the folder/pin actions.
    const isInLibrary = isOwner || savedPlaylists.some((p) => p.id === playlist.id)
    const isPrivate = (playlist.visibility ?? (playlist.isPublic ? 'public' : 'private')) === 'private'
    const currentFolderId = folderOfItem(folders, itemKey)

    // Pointer-anchored open/close/reopen behaviour shared with every other menu.
    const menu = usePointerMenu()
    const { coords, hiddenBtnRef, openAt, openFromButton } = menu
    // Reset the (hover) "Move to folder" flyout each time the menu (re)opens.
    useImperativeHandle(ref, () => ({
      openAt: (x: number, y: number) => {
        setFolderSubmenuOpen(false)
        openAt(x, y)
      },
    }), [openAt])

    const openFolderSubmenu = () => {
      if (folderCloseTimer.current) {
        clearTimeout(folderCloseTimer.current)
        folderCloseTimer.current = null
      }
      setFolderSubmenuOpen(true)
    }
    const scheduleCloseFolderSubmenu = () => {
      if (folderCloseTimer.current) clearTimeout(folderCloseTimer.current)
      folderCloseTimer.current = window.setTimeout(() => setFolderSubmenuOpen(false), 120)
    }

    // ── Actions ───────────────────────────────────────────────────────
    const handleAddToQueue = () => {
      const tracks = (playlist.tracks ?? []).map((pt) => pt.track)
      if (tracks.length === 0) {
        notify.info('No tracks in this playlist yet')
        return
      }
      tracks.forEach((track) => addToQueue(track))
      notify.success(`Added ${tracks.length} song${tracks.length === 1 ? '' : 's'} to queue`)
    }

    const handleAddToProfile = async () => {
      try {
        await savePlaylist(playlist)
        notify.success('Saved to Your Library')
      } catch {
        notify.error("Couldn't save playlist")
      }
    }

    const handleRemoveFromProfile = async () => {
      try {
        await unsavePlaylist(playlist.id)
        notify.success('Removed from your library')
      } catch {
        notify.error("Couldn't remove playlist")
      }
    }

    const handleDelete = async () => {
      if (onDelete) {
        await onDelete()
        return
      }
      try {
        await deletePlaylist(playlist.id)
        notify.success('Playlist deleted')
      } catch {
        notify.error("Couldn't delete playlist")
      }
    }

    const handleCreatePlaylist = async () => {
      try {
        const created = await createPlaylist('My Playlist')
        navigate(`/playlist/${created.id}`)
      } catch {
        notify.error("Couldn't create playlist")
      }
    }

    const handleToggleVisibility = async () => {
      try {
        await setPlaylistVisibility(playlist.id, isPrivate ? 'public' : 'private')
        notify.success(isPrivate ? 'Playlist is now public' : 'Playlist is now private')
      } catch {
        notify.error("Couldn't update playlist")
      }
    }

    const handleShare = async () => {
      const result = await shareLink(`/playlist/${playlist.id}`, {
        title: playlist.name,
        text: playlist.name,
      })
      if (result === 'copied') notify.success('Link copied to clipboard')
      else if (result === 'failed') notify.error("Couldn't copy link")
    }

    const stop = (e: React.SyntheticEvent) => e.stopPropagation()

    const itemClass = CONTEXT_MENU_ITEM_CLASS

    return (
      <Menu>
        {({ close, open }) => {
          menu.sync(open, close)
          return (
            <>
              {/* Invisible, body-portaled trigger parked at the cursor. */}
              {(alwaysVisible || triggerClassName) && (
                <button
                  type="button"
                  aria-label={`More options for ${playlist.name}`}
                  title={`More options for ${playlist.name}`}
                  onClick={(e) => {
                    e.preventDefault()
                    stop(e)
                    if (open) close()
                    else openFromButton(e)
                  }}
                  className={`cursor-pointer transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'} ${triggerClassName ?? ''}`}
                >
                  <EllipsisHorizontalIcon className={triggerIconClassName ?? 'h-5 w-5 stroke-[2.2] text-secondary hover:text-primary'} />
                  {triggerClassName?.includes('spotify-tooltip-anchor') && (
                    <span className="spotify-tooltip spotify-tooltip-top spotify-tooltip-center">More options</span>
                  )}
                </button>
              )}
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
                onContextMenu={(e) => e.preventDefault()}
                className={CONTEXT_MENU_PANEL_CLASS}
              >
                <MenuItem>
                  <button type="button" onClick={(e) => { stop(e); handleAddToQueue(); close() }} className={itemClass}>
                    <QueueListIcon className="h-4 w-4" />
                    Add to queue
                  </button>
                </MenuItem>
                <MenuItem>
                  {isInLibrary ? (
                    <button type="button" onClick={(e) => { stop(e); void handleRemoveFromProfile(); close() }} className={itemClass}>
                      <MinusCircleIcon className="h-4 w-4" />
                      Remove from profile
                    </button>
                  ) : (
                    <button type="button" onClick={(e) => { stop(e); void handleAddToProfile(); close() }} className={itemClass}>
                      <UserCircleIcon className="h-4 w-4" />
                      Add to profile
                    </button>
                  )}
                </MenuItem>

                {isOwner && (
                  <>
                    <div className="my-1 h-px bg-secondary/20" />

                    <MenuItem>
                      <button
                        type="button"
                        onClick={(e) => {
                          stop(e)
                          if (onEditDetails) onEditDetails()
                          else navigate(`/playlist/${playlist.id}`)
                          close()
                        }}
                        className={itemClass}
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit details
                      </button>
                    </MenuItem>
                    {onAddSongs && !playlist.smartRules && (
                      <MenuItem>
                        <button type="button" onClick={(e) => { stop(e); onAddSongs(); close() }} className={itemClass}>
                          <PlusIcon className="h-4 w-4" />
                          Add songs
                        </button>
                      </MenuItem>
                    )}
                    {onExport && (playlist.tracks?.length ?? 0) > 0 && (
                      <MenuItem>
                        <button type="button" onClick={(e) => { stop(e); onExport(); close() }} className={itemClass}>
                          <ArrowUpTrayIcon className="h-4 w-4" />
                          Export
                        </button>
                      </MenuItem>
                    )}
                    <MenuItem>
                      <button type="button" onClick={(e) => { stop(e); void handleDelete(); close() }} className={itemClass}>
                        <MinusCircleIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </MenuItem>
                  </>
                )}

                <div className="my-1 h-px bg-secondary/20" />

                <MenuItem>
                  <button type="button" onClick={(e) => { stop(e); void handleCreatePlaylist(); close() }} className={itemClass}>
                    <MusicalNoteIcon className="h-4 w-4" />
                    Create playlist
                  </button>
                </MenuItem>
                {isInLibrary && (
                  <MenuItem>
                    <button
                      type="button"
                      onClick={(e) => { stop(e); addItemToFolder(createFolder().id, itemKey); close() }}
                      className={itemClass}
                    >
                      <FolderPlusIcon className="h-4 w-4" />
                      Create folder
                    </button>
                  </MenuItem>
                )}

                <div className="my-1 h-px bg-secondary/20" />

                {isOwner && (
                  <>
                    <MenuItem>
                      <button type="button" onClick={(e) => { stop(e); void handleToggleVisibility(); close() }} className={itemClass}>
                        {isPrivate ? <LockOpenIcon className="h-4 w-4" /> : <LockClosedIcon className="h-4 w-4" />}
                        {isPrivate ? 'Make public' : 'Make private'}
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button type="button" onClick={(e) => { stop(e); setInviteOpen(true); close() }} className={itemClass}>
                        <UserPlusIcon className="h-4 w-4" />
                        Invite collaborators
                      </button>
                    </MenuItem>
                  </>
                )}
                <MenuItem>
                  <button
                    type="button"
                    onClick={(e) => { stop(e); notify.info('Excluded from your taste profile'); close() }}
                    className={itemClass}
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Exclude from your taste profile
                  </button>
                </MenuItem>

                {/* Move to folder — hover flyout (not a MenuItem so it doesn't auto-close).
                    Only shown for playlists already in the library. */}
                {isInLibrary && (
                  <div
                    className="relative"
                    onMouseDown={stop}
                    onPointerDown={stop}
                    onMouseEnter={openFolderSubmenu}
                    onMouseLeave={scheduleCloseFolderSubmenu}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openFolderSubmenu() }}
                      className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
                    >
                      <span className="flex items-center gap-3">
                        <FolderIcon className="h-4 w-4" />
                        Move to folder
                      </span>
                      <ChevronRightIcon className="h-4 w-4 text-secondary" />
                    </button>
                    {folderSubmenuOpen && (
                      <div
                        onClick={stop}
                        onMouseDown={stop}
                        onPointerDown={stop}
                        onMouseEnter={openFolderSubmenu}
                        onMouseLeave={scheduleCloseFolderSubmenu}
                        className="absolute left-full top-0 ml-1 w-64 max-h-80 overflow-y-auto rounded-md bg-[#282828] py-1.5 text-sm font-normal leading-5 shadow-2xl ring-1 ring-black/20"
                      >
                        <button
                          type="button"
                          onClick={(e) => { stop(e); addItemToFolder(createFolder().id, itemKey); setFolderSubmenuOpen(false); close() }}
                          className={CONTEXT_MENU_ITEM_CLASS}
                        >
                          <FolderPlusIcon className="h-4 w-4" />
                          New folder
                        </button>
                        {folders.length > 0 && <div className="my-1 h-px bg-secondary/20" />}
                        {folders.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={(e) => { stop(e); addItemToFolder(f.id, itemKey); setFolderSubmenuOpen(false); close() }}
                            className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
                          >
                            <span className="truncate">{f.name}</span>
                            {currentFolderId === f.id && <CheckIcon className="h-4 w-4 shrink-0 text-accent" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="my-1 h-px bg-secondary/20" />

                {isInLibrary && (
                  <MenuItem>
                    <button type="button" onClick={(e) => { stop(e); togglePinned(itemKey); close() }} className={itemClass}>
                      <PinIcon className={pinned ? 'h-4 w-4 text-accent' : 'h-4 w-4'} />
                      {pinned ? 'Unpin playlist' : 'Pin playlist'}
                    </button>
                  </MenuItem>
                )}
                <MenuItem>
                  <button type="button" onClick={(e) => { stop(e); void handleShare(); close() }} className={itemClass}>
                    <ShareIcon className="h-4 w-4" />
                    Share
                  </button>
                </MenuItem>
              </MenuItems>

              {inviteOpen && (
                <InviteCollaboratorModal
                  playlistId={playlist.id}
                  existingCollaborators={playlist.collaborators ?? []}
                  onInvited={() => notify.success('Invitation sent')}
                  onClose={() => setInviteOpen(false)}
                />
              )}
            </>
          )
        }}
      </Menu>
    )
  },
)

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3.5h6M10.5 3.5v5.2L8 11.7v1.1h8v-1.1L13.5 8.7V3.5M12 12.8V20.5" />
    </svg>
  )
}
