import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  ArrowTopRightOnSquareIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  RadioIcon,
  ShareIcon,
  UserMinusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import type { Artist } from '@/types/artist'
import { artistService } from '@/services/artistService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackGate } from '@/hooks/usePlaybackGate'
import { shareLink } from '@/utils/share'
import { notify } from '@/utils/toast'
import { InstallAppMenuItem } from '@/components/common/InstallAppButton'

interface ArtistMenuProps {
  artist: Artist
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

export interface ArtistMenuHandle {
  openAt: (x: number, y: number) => void
}

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
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 })
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
        if (menuOpenRef.current && !open) closedAtRef.current = Date.now()
        menuOpenRef.current = open
        closeRef.current = close
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
            className="z-50 w-56 origin-top overflow-visible! rounded-md bg-[#282828] shadow-2xl ring-1 ring-black/20 py-1 text-[13px] font-bold focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <MenuItem>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  handleToggleFollow()
                  close()
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]"
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]"
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]"
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]"
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
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]"
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
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e] data-[focus]:bg-[#3e3e3e]"
              >
                <span>Go to artist</span>
                <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
              </button>
            </MenuItem>

            <InstallAppMenuItem
              label="Open in Desktop app"
              onSelect={close}
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-primary hover:bg-[#3e3e3e]"
            />
          </MenuItems>
        </>
        )
      }}
    </Menu>
  )
})
