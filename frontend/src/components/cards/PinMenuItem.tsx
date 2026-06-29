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
      <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134c.064.374.143.844.16 1.013.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0L5.94 10.768 2.757 13.95c-.195.195-.707.707-1.414 0-.707-.707-.195-1.219 0-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72.169.016.639.095 1.013.159L8.22 2.302c-.02-.125-.039-.283-.04-.46 0-.43.108-1.022.589-1.503a.5.5 0 0 1 .707 0z" />
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
