import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  FolderIcon,
  FolderPlusIcon,
  LockClosedIcon,
  LockOpenIcon,
  MusicalNoteIcon,
  PencilIcon,
  QueueListIcon,
  ShareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, CheckIcon, PlusCircleIcon } from '@heroicons/react/24/solid'
import type { Playlist } from '@/types/playlist'
import { playlistService } from '@/services/playlistService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useConfirm } from '@/hooks/useConfirm'
import { isPinned, togglePinned } from '@/utils/pinnedLibrary'
import {
  addItemToFolder,
  createFolder,
  folderOfItem,
  getFolders,
  removeItemFromFolder,
} from '@/utils/libraryFolders'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import { PinIcon } from '@/components/icons/PinIcon'
import { InstallAppMenuItem } from '@/components/common/InstallAppButton'

interface PlaylistMenuProps {
  playlist: Playlist
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
  /** Which hover group reveals the trigger: card cards use `group`, sidebar
   *  rows use `group/row`. Ignored when `alwaysVisible`. */
  hoverGroup?: 'group' | 'row'
}

export interface PlaylistMenuHandle {
  openAt: (x: number, y: number) => void
}

const itemClass =
  'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]'

export const PlaylistMenu = forwardRef<PlaylistMenuHandle, PlaylistMenuProps>(function PlaylistMenu({
  playlist,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
  hoverGroup = 'group',
}, ref) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savedPlaylists = useLibraryStore((s) => s.savedPlaylists)
  const savePlaylist = useLibraryStore((s) => s.savePlaylist)
  const unsavePlaylist = useLibraryStore((s) => s.unsavePlaylist)
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist)
  const setPlaylistVisibility = useLibraryStore((s) => s.setPlaylistVisibility)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  const isOwner = playlist.isOwner ?? false
  const isSaved = isOwner || savedPlaylists.some((p) => p.id === playlist.id)
  const itemKey = `pl-${playlist.id}`

  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 })
  // 'root' is the main list; 'folders' is the "Move to folder" submenu view.
  const [view, setView] = useState<'root' | 'folders'>('root')
  const hiddenBtnRef = useRef<HTMLButtonElement>(null)
  const menuOpenRef = useRef(false)
  const closeRef = useRef<(() => void) | null>(null)
  const closedAtRef = useRef(0)

  const openAt = (x: number, y: number) => {
    if (menuOpenRef.current) {
      closeRef.current?.()
      return
    }
    // A right-click's pointerdown makes Headless close the open menu *before*
    // this contextmenu handler runs (they're separate native events, so React
    // flushes the close between them) — menuOpenRef therefore already reads
    // false. Without this guard the menu would instantly reopen, looking like
    // it never closes. Treat a just-closed menu as the toggle-off.
    if (Date.now() - closedAtRef.current < 300) return
    setView('root')
    setCoords({ x, y })
    requestAnimationFrame(() => hiddenBtnRef.current?.click())
  }

  const openFromButton = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openAt(r.left, r.bottom + 4)
  }

  useImperativeHandle(ref, () => ({ openAt }), [])

  const gate = (title: string, action: () => void | Promise<void>) => {
    if (!isAuthenticated) {
      openAuthPrompt({ title, imageUrl: playlist.coverUrl ?? undefined })
      return
    }
    void action()
  }

  const resolveTracks = async () => {
    const resolved = playlist.tracks?.length ? playlist : await playlistService.getById(playlist.id)
    return resolved.tracks.map((pt) => pt.track)
  }

  const handleAddToQueue = () =>
    gate('Add to queue with a free account', async () => {
      try {
        const tracks = await resolveTracks()
        if (tracks.length === 0) {
          notify.info('This playlist has no songs yet')
          return
        }
        tracks.forEach((track) => addToQueue(track))
        notify.success(`Added ${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'} to queue`)
      } catch {
        notify.error("Couldn't add to queue")
      }
    })

  const handleToggleSave = () =>
    gate('Save playlists with a free account', async () => {
      if (isSaved) {
        await unsavePlaylist(playlist.id)
        notify.success('Removed from Your Library')
      } else {
        await savePlaylist(playlist)
        notify.success('Saved to Your Library')
      }
    })

  const handleDelete = async () => {
    if (!(await confirm({
      title: `Delete "${playlist.name}"?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return
    try {
      await deletePlaylist(playlist.id)
      notify.success('Playlist deleted')
    } catch {
      notify.error("Couldn't delete playlist")
    }
  }

  // Owner playlists fall back to isPublic when the three-state visibility is absent.
  const isPrivate = playlist.visibility ? playlist.visibility === 'private' : !playlist.isPublic

  const handleToggleVisibility = () =>
    gate('Manage playlists with a free account', async () => {
      const next = isPrivate ? 'public' : 'private'
      await setPlaylistVisibility(playlist.id, next)
      notify.success(next === 'private' ? 'Playlist is now private' : 'Playlist is now public')
    })

  const handleShare = async () => {
    const result = await shareLink(`/playlist/${playlist.id}`, {
      title: playlist.name,
      text: `${playlist.name} · ${playlist.owner.name}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  const pinned = isPinned(itemKey)
  const folders = getFolders()
  const currentFolderId = folderOfItem(folders, itemKey)

  const triggerReveal = alwaysVisible
    ? 'opacity-100'
    : hoverGroup === 'row'
      ? 'opacity-100 md:opacity-0 md:group-hover/row:opacity-100'
      : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <Menu>
      {({ close, open }) => {
        if (menuOpenRef.current && !open) closedAtRef.current = Date.now()
        menuOpenRef.current = open
        closeRef.current = close
        return (
          <>
            <button
              type="button"
              aria-label={`More options for ${playlist.name}`}
              onClick={(e) => {
                e.preventDefault()
                stop(e)
                if (open) close()
                else openFromButton(e)
              }}
              className={`cursor-pointer transition-opacity ${triggerReveal} ${triggerClassName ?? ''}`}
            >
              <EllipsisHorizontalIcon className={triggerIconClassName ?? 'h-5 w-5 stroke-[2.2] text-white'} />
            </button>

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
              className="z-50 w-60 origin-top overflow-visible! rounded-md bg-[#282828] shadow-2xl ring-1 ring-black/20 py-1 text-[13px] font-bold focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
            >
              {view === 'root' ? (
                <>
                  <MenuItem>
                    <button type="button" onClick={(e) => { stop(e); handleAddToQueue(); close() }} className={itemClass}>
                      <QueueListIcon className="h-4 w-4" />
                      Add to queue
                    </button>
                  </MenuItem>

                  {isOwner ? (
                    <>
                      <MenuItem>
                        <button type="button" onClick={(e) => { stop(e); navigate(`/playlist/${playlist.id}`); close() }} className={itemClass}>
                          <PencilIcon className="h-4 w-4" />
                          Edit details
                        </button>
                      </MenuItem>
                      <MenuItem>
                        <button type="button" onClick={(e) => { stop(e); void handleDelete(); close() }} className={itemClass}>
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      </MenuItem>
                    </>
                  ) : (
                    <MenuItem>
                      <button type="button" onClick={(e) => { stop(e); handleToggleSave(); close() }} className={itemClass}>
                        {isSaved ? <CheckCircleIcon className="h-4 w-4 text-accent" /> : <PlusCircleIcon className="h-4 w-4" />}
                        {isSaved ? 'Remove from Your Library' : 'Save to Your Library'}
                      </button>
                    </MenuItem>
                  )}

                  <div className="my-1 h-px bg-secondary/20" />

                  {isOwner && (
                    <MenuItem>
                      <button type="button" onClick={(e) => { stop(e); handleToggleVisibility(); close() }} className={itemClass}>
                        {isPrivate ? <LockOpenIcon className="h-4 w-4" /> : <LockClosedIcon className="h-4 w-4" />}
                        {isPrivate ? 'Make public' : 'Make private'}
                      </button>
                    </MenuItem>
                  )}

                  {/* Switches the menu to the folder picker without closing it. Not a
                      MenuItem so the click doesn't dismiss the whole menu. */}
                  <button
                    type="button"
                    onClick={(e) => { stop(e); setView('folders') }}
                    className={`${itemClass} justify-between`}
                  >
                    <span className="flex items-center gap-2">
                      <FolderIcon className="h-4 w-4" />
                      Move to folder
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-secondary" />
                  </button>

                  <MenuItem>
                    <button type="button" onClick={(e) => { stop(e); togglePinned(itemKey); close() }} className={itemClass}>
                      <PinIcon className="h-4 w-4" />
                      {pinned ? 'Unpin playlist' : 'Pin playlist'}
                    </button>
                  </MenuItem>

                  <div className="my-1 h-px bg-secondary/20" />

                  <MenuItem>
                    <button type="button" onClick={(e) => { stop(e); navigate(`/playlist/${playlist.id}`); close() }} className={itemClass}>
                      <MusicalNoteIcon className="h-4 w-4" />
                      Go to playlist
                    </button>
                  </MenuItem>

                  <MenuItem>
                    <button type="button" onClick={(e) => { stop(e); void handleShare(); close() }} className={itemClass}>
                      <ShareIcon className="h-4 w-4" />
                      Share
                    </button>
                  </MenuItem>

                  <MenuItem>
                    <button type="button" onClick={(e) => { stop(e); navigate(`/playlist/${playlist.id}`); close() }} className={`${itemClass} justify-between`}>
                      <span>Open playlist page</span>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
                    </button>
                  </MenuItem>

                  <InstallAppMenuItem
                    label="Open in Desktop app"
                    onSelect={close}
                    className={`${itemClass} justify-between`}
                  />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => { stop(e); setView('root') }}
                    className={`${itemClass} text-secondary`}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Move to folder
                  </button>
                  <div className="my-1 h-px bg-secondary/20" />
                  <div className="max-h-56 overflow-y-auto">
                    {folders.length === 0 && (
                      <p className="px-3 py-1.5 text-xs font-semibold text-secondary">No folders yet</p>
                    )}
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={(e) => { stop(e); addItemToFolder(f.id, itemKey); notify.success(`Moved to "${f.name}"`); close() }}
                        className={`${itemClass} justify-between`}
                      >
                        <span className="truncate">{f.name}</span>
                        {currentFolderId === f.id && <CheckIcon className="h-4 w-4 shrink-0 text-accent" />}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { stop(e); const f = createFolder(); addItemToFolder(f.id, itemKey); notify.success('Created folder'); close() }}
                    className={itemClass}
                  >
                    <FolderPlusIcon className="h-4 w-4" />
                    New folder
                  </button>
                  {currentFolderId && (
                    <>
                      <div className="my-1 h-px bg-secondary/20" />
                      <button
                        type="button"
                        onClick={(e) => { stop(e); removeItemFromFolder(itemKey); notify.success('Removed from folder'); close() }}
                        className={itemClass}
                      >
                        Remove from folder
                      </button>
                    </>
                  )}
                </>
              )}
            </MenuItems>
          </>
        )
      }}
    </Menu>
  )
})
