import { useEffect, useState } from 'react'
import { MenuItem } from '@headlessui/react'
import { isPinned, togglePinned, PINNED_EVENT } from '@/utils/pinnedLibrary'
import { CONTEXT_MENU_ITEM_CLASS } from '@/utils/contextMenu'

/**
 * Live pinned-state for a sidebar LibItem key (`pl-…` / `al-…` / `ar-…` /
 * `vid-…` / `pod-…`). Stays in step with every other open view via PINNED_EVENT
 * and cross-tab `storage` events. Returns the current state plus a toggle.
 */
export function usePinned(itemKey: string): [boolean, () => boolean] {
  const [pinned, setPinned] = useState(() => isPinned(itemKey))
  useEffect(() => {
    const sync = () => setPinned(isPinned(itemKey))
    sync()
    window.addEventListener(PINNED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PINNED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [itemKey])
  return [pinned, () => togglePinned(itemKey)]
}

/**
 * Spotify-style tilted pushpin glyph, used by the pin menu item and the
 * pinned-row badge that sits on the subtitle line.
 */
export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M10.591 1.058a.75.75 0 0 1 1.061 0l3.29 3.29a.75.75 0 0 1 0 1.061l-.708.708a3.75 3.75 0 0 1-4.27.721l-1.98 1.98a1.75 1.75 0 0 1 0 2.475l-.707.707a.75.75 0 0 1-1.061 0L4.06 12l-2.53 2.53a.75.75 0 1 1-1.06-1.06L3 10.939 1.518 9.457a.75.75 0 0 1 0-1.06l.707-.708a1.75 1.75 0 0 1 2.475 0l1.98-1.98a3.75 3.75 0 0 1 .721-4.27l.708-.708z" />
    </svg>
  )
}

/**
 * "Pin to top" / "Unpin" row for any Headless-UI card menu (playlist, album,
 * artist). Self-contained: it owns its pinned state and toggles the shared
 * pinnedLibrary store. `onAfter` is the menu's `close`.
 */
export function PinMenuItem({ itemKey, onAfter }: { itemKey: string; onAfter?: () => void }) {
  const [pinned, toggle] = usePinned(itemKey)
  return (
    <MenuItem>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggle()
          onAfter?.()
        }}
        className={CONTEXT_MENU_ITEM_CLASS}
      >
        <PinIcon className={pinned ? 'h-4 w-4 text-accent' : 'h-4 w-4'} />
        {pinned ? 'Unpin' : 'Pin to top'}
      </button>
    </MenuItem>
  )
}
