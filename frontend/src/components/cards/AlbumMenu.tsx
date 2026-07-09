import { forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  ArrowTopRightOnSquareIcon,
  EllipsisHorizontalIcon,
  MusicalNoteIcon,
  QueueListIcon,
  RadioIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid'
import type { Album } from '@/types/album'
import { trackService } from '@/services/trackService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { usePointerMenu } from '@/hooks/usePointerMenu'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import {
  CONTEXT_MENU_ITEM_CLASS,
  CONTEXT_MENU_PANEL_CLASS,
  type PointerMenuHandle,
} from '@/utils/contextMenu'
import { InstallAppMenuItem } from '@/components/common/InstallAppButton'
import { OfflineDownloadMenuItem } from '@/components/common/OfflineDownloadMenuItem'
import { ShareIcon } from '@/components/common/ShareIcon'
import { PinMenuItem } from './PinMenuItem'

interface AlbumMenuProps {
  album: Album
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export type AlbumMenuHandle = PointerMenuHandle

export const AlbumMenu = forwardRef<AlbumMenuHandle, AlbumMenuProps>(function AlbumMenu({
  album,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const savedAlbumIds = useLibraryStore((s) => s.savedAlbumIds)
  const saveAlbum = useLibraryStore((s) => s.saveAlbum)
  const unsaveAlbum = useLibraryStore((s) => s.unsaveAlbum)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const isSaved = savedAlbumIds.has(album.id)
  const menu = usePointerMenu()
  const { coords, hiddenBtnRef, openAt, openFromButton } = menu

  useImperativeHandle(ref, () => ({ openAt }), [openAt])

  const gate = (title: string, action: () => void | Promise<void>) => {
    if (!isAuthenticated) {
      openAuthPrompt({ title, imageUrl: album.coverUrl })
      return
    }
    void action()
  }

  const handleToggleSave = () =>
    gate('Save albums with a free account', async () => {
      if (isSaved) {
        await unsaveAlbum(album.id)
        notify.success('Removed from Your Library')
      } else {
        await saveAlbum(album)
        notify.success('Saved to Your Library')
      }
    })

  const handleAddToQueue = () =>
    gate('Add to queue with a free account', async () => {
      try {
        const tracks = await trackService.getByAlbum(album.id)
        if (tracks.length === 0) {
          notify.info('No tracks available for this album yet')
          return
        }
        tracks.forEach((track) => addToQueue(track))
        notify.success(`Added ${tracks.length} song${tracks.length === 1 ? '' : 's'} to queue`)
      } catch {
        notify.error("Couldn't add to queue")
      }
    })

  const handleAlbumRadio = () =>
    gate('Start album radio with a free account', async () => {
      try {
        const tracks = await trackService.getByAlbum(album.id)
        if (tracks.length > 0) playWithGate(tracks[0], tracks)
        else notify.info('No tracks available for this album yet')
      } catch {
        notify.error("Couldn't start album radio")
      }
    })

  const handleShare = async () => {
    const result = await shareLink(`/album/${album.id}`, {
      title: album.title,
      text: `${album.title} · ${album.artist.name}`,
    })
    if (result === 'copied') notify.success('Link copied to clipboard')
    else if (result === 'failed') notify.error("Couldn't copy link")
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <Menu>
      {({ close, open }) => {
        menu.sync(open, close)
        return (
          <>
            <button
              type="button"
              aria-label={`More options for ${album.title}`}
              title={`More options for ${album.title}`}
              onClick={(e) => {
                e.preventDefault()
                stop(e)
                if (open) close()
                else openFromButton(e)
              }}
              className={`cursor-pointer transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'} ${triggerClassName ?? ''}`}
            >
              <EllipsisHorizontalIcon className={triggerIconClassName ?? 'h-5 w-5 stroke-[2.2] text-secondary'} />
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
              className={CONTEXT_MENU_PANEL_CLASS}
            >
              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    handleAddToQueue()
                    close()
                  }}
                  className={CONTEXT_MENU_ITEM_CLASS}
                >
                  <QueueListIcon className="w-4 h-4" />
                  Add to queue
                </button>
              </MenuItem>

              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    handleToggleSave()
                    close()
                  }}
                  className={CONTEXT_MENU_ITEM_CLASS}
                >
                  {isSaved ? <CheckCircleIcon className="w-4 h-4 text-accent" /> : <PlusCircleIcon className="w-4 h-4" />}
                  {isSaved ? 'Remove from Your Library' : 'Save to Your Library'}
                </button>
              </MenuItem>

              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    handleAlbumRadio()
                    close()
                  }}
                  className={CONTEXT_MENU_ITEM_CLASS}
                >
                  <RadioIcon className="w-4 h-4" />
                  Go to album radio
                </button>
              </MenuItem>

              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    void handleShare()
                    close()
                  }}
                  className={CONTEXT_MENU_ITEM_CLASS}
                >
                  <ShareIcon className="w-4 h-4" />
                  Share
                </button>
              </MenuItem>

              <OfflineDownloadMenuItem
                meta={{
                  kind: 'album',
                  id: album.id,
                  name: album.title,
                  subtitle: album.artist.name,
                  coverUrl: album.coverUrl,
                }}
                getTracks={() => trackService.getByAlbum(album.id)}
              />

              {/* Pin floats this album to the top of the library sidebar. */}
              {isSaved && <PinMenuItem itemKey={`al-${album.id}`} onAfter={close} />}

              <div className="my-1 h-px bg-secondary/20" />

              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    navigate(`/album/${album.id}`)
                    close()
                  }}
                  className={CONTEXT_MENU_ITEM_CLASS}
                >
                  <MusicalNoteIcon className="w-4 h-4" />
                  Go to album
                </button>
              </MenuItem>

              <MenuItem>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    navigate(`/artist/${album.artist.id}`)
                    close()
                  }}
                  className={CONTEXT_MENU_ITEM_CLASS}
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
                    navigate(`/album/${album.id}`)
                    close()
                  }}
                  className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
                >
                  <span>Open album page</span>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
                </button>
              </MenuItem>

              <InstallAppMenuItem
                label="Open in Desktop app"
                onSelect={close}
                className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
              />
            </MenuItems>
          </>
        )
      }}
    </Menu>
  )
})
