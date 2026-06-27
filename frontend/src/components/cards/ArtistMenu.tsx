import { forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  ArrowTopRightOnSquareIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  RadioIcon,
  UserMinusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import type { Artist } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
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
import { ShareIcon } from '@/components/common/ShareIcon'

interface ArtistMenuProps {
  artist: Artist
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export type ArtistMenuHandle = PointerMenuHandle

export const ArtistMenu = forwardRef<ArtistMenuHandle, ArtistMenuProps>(function ArtistMenu({
  artist,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const navigate = useNavigate()
  const playWithGate = usePlaybackGate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useAuthPromptStore((s) => s.open)
  const followedArtistIds = useLibraryStore((s) => s.followedArtistIds)
  const followArtist = useLibraryStore((s) => s.followArtist)
  const unfollowArtist = useLibraryStore((s) => s.unfollowArtist)
  const isFollowing = followedArtistIds.has(artist.id)
  const menu = usePointerMenu()
  const { coords, hiddenBtnRef, openAt, openFromButton } = menu

  useImperativeHandle(ref, () => ({ openAt }), [openAt])

  const gate = (title: string, action: () => void | Promise<void>) => {
    if (!isAuthenticated) {
      openAuthPrompt({ title, imageUrl: artist.imageUrl })
      return
    }
    void action()
  }

  const handleToggleFollow = () =>
    gate('Follow artists with a free account', async () => {
      if (isFollowing) {
        await unfollowArtist(artist.id)
        notify.success(`Unfollowed ${artist.name}`)
      } else {
        await followArtist(artist)
        notify.success(`Added ${artist.name} to Your Library`)
      }
    })

  const handleArtistRadio = () =>
    gate('Start artist radio with a free account', async () => {
      try {
        const tracks = await artistService.getTopTracks(artist.id, 20)
        if (tracks.length > 0) playWithGate(tracks[0], tracks)
        else notify.info('No tracks available for this artist yet')
      } catch {
        notify.error("Couldn't start artist radio")
      }
    })

  const handleShare = async () => {
    const result = await shareLink(`/artist/${artist.id}`, {
      title: artist.name,
      text: artist.name,
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
            aria-label={`More options for ${artist.name}`}
            onClick={(e) => {
              e.preventDefault()
              stop(e)
              if (open) close()
              else openFromButton(e)
            }}
            className={`cursor-pointer transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'} ${triggerClassName ?? ''}`}
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
            className={CONTEXT_MENU_PANEL_CLASS}
          >
            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  handleToggleFollow()
                  close()
                }}
                className={CONTEXT_MENU_ITEM_CLASS}
              >
                {isFollowing ? <UserMinusIcon className="w-4 h-4" /> : <UserPlusIcon className="w-4 h-4" />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            </MenuItem>

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  notify.info("We'll avoid recommending this artist")
                  close()
                }}
                className={CONTEXT_MENU_ITEM_CLASS}
              >
                <NoSymbolIcon className="w-4 h-4" />
                Don't play this artist
              </button>
            </MenuItem>

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  handleArtistRadio()
                  close()
                }}
                className={CONTEXT_MENU_ITEM_CLASS}
              >
                <RadioIcon className="w-4 h-4" />
                Go to artist radio
              </button>
            </MenuItem>

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  notify.success('Report submitted for review')
                  close()
                }}
                className={CONTEXT_MENU_ITEM_CLASS}
              >
                <ExclamationTriangleIcon className="w-4 h-4" />
                Report
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

            <div className="my-1 h-px bg-secondary/20" />

            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  navigate(`/artist/${artist.id}`)
                  close()
                }}
                className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
              >
                <span>Go to artist</span>
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
