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

/** The little pushpin glyph used by the pin menu item and pinned-row badges. */
export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path
        d="M5.25 1.5h5.5v1.2L9.6 3.85v3.1l1.65 1.65v1.15H8.6v4.75H7.4V9.75H4.75V8.6L6.4 6.95v-3.1L5.25 2.7V1.5Z"
        transform="rotate(45 8 8)"
      />
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
