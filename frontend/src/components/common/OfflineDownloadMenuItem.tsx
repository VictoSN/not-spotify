import { MenuItem } from '@headlessui/react'
import { ArrowDownCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import type { Track } from '@/types/track'
import { useAuthStore } from '@/stores/authStore'
import { useOfflineCollection } from '@/hooks/useOfflineCollection'
import type { CollectionMeta } from '@/services/offlineAudio'
import { CONTEXT_MENU_ITEM_CLASS } from '@/utils/contextMenu'

/**
 * "Download" row for an album/playlist context menu — batch-saves every track
 * for offline. Premium-gated and desktop-gated: hidden for free users, grayed
 * with a "Desktop" badge in the browser. `getTracks` is called lazily on click.
 */
export function OfflineDownloadMenuItem({
  meta,
  getTracks,
}: {
  meta: CollectionMeta
  getTracks: () => Promise<Track[]> | Track[]
}) {
  const isPremium = useAuthStore((s) => s.user?.plan === 'premium')
  const offline = useOfflineCollection(meta, getTracks)

  if (!isPremium) return null
  if (!offline.available && !offline.desktopOnly) return null

  const label = offline.busy
    ? offline.progress
      ? `Downloading ${offline.progress.done}/${offline.progress.total}…`
      : offline.saved
        ? 'Removing…'
        : 'Downloading…'
    : offline.saved
      ? 'Downloaded — remove'
      : 'Download'

  return (
    <MenuItem>
      <button
        type="button"
        disabled={offline.busy || offline.desktopOnly}
        title={offline.desktopOnly ? 'Available in the desktop app' : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (offline.desktopOnly) return
          void offline.toggle()
        }}
        className={`${CONTEXT_MENU_ITEM_CLASS} ${offline.desktopOnly ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {offline.busy ? (
          <ArrowPathIcon className="h-4 w-4 animate-spin text-accent" />
        ) : offline.saved ? (
          <CheckCircleIcon className="h-4 w-4 text-accent" />
        ) : (
          <ArrowDownCircleIcon className="h-4 w-4" />
        )}
        <span className="flex flex-1 items-center justify-between gap-2">
          <span>{label}</span>
          {offline.desktopOnly && (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-accent">
              Desktop
            </span>
          )}
        </span>
      </button>
    </MenuItem>
  )
}
