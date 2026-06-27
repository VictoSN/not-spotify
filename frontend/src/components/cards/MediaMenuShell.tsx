import { forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { usePointerMenu } from '@/hooks/usePointerMenu'
import {
  CONTEXT_MENU_ITEM_CLASS,
  CONTEXT_MENU_PANEL_CLASS,
  type PointerMenuHandle,
} from '@/utils/contextMenu'

interface MediaMenuShellProps {
  /** Accessible label for the visible "…" trigger button. */
  ariaLabel: string
  /** Render the menu rows. `close` dismisses the menu (call it after navigating/acting). */
  children: (close: () => void) => ReactNode
  alwaysVisible?: boolean
  triggerClassName?: string
  triggerIconClassName?: string
}

/**
 * The single shared shell behind every pointer-anchored media menu (track, album,
 * artist, playlist, video, episode). It owns the exact same `usePointerMenu`
 * behaviour, the body-portaled cursor trigger, and the `MenuItems` panel styling
 * the rest of the app uses — so right-click, the "…" button, positioning and hover
 * feel identical everywhere. Menus only supply their rows via {@link MediaMenuItem}.
 */
export const MediaMenuShell = forwardRef<PointerMenuHandle, MediaMenuShellProps>(function MediaMenuShell({
  ariaLabel,
  children,
  alwaysVisible,
  triggerClassName,
  triggerIconClassName,
}, ref) {
  const menu = usePointerMenu()
  const { coords, hiddenBtnRef, openAt, openFromButton } = menu
  useImperativeHandle(ref, () => ({ openAt }), [openAt])
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <Menu>
      {({ close, open }) => {
        menu.sync(open, close)
        return (
          <>
            <button
              type="button"
              aria-label={ariaLabel}
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
              {children(close)}
            </MenuItems>
          </>
        )
      }}
    </Menu>
  )
})

interface MediaMenuItemProps {
  /** Left-aligned leading icon node; the shared panel normalises it to 18px. */
  icon?: ReactNode
  label: ReactNode
  /** Right-aligned trailing node (e.g. an "open in new tab" arrow). */
  trailing?: ReactNode
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
}

/** A single row inside {@link MediaMenuShell}, styled identically to the app's card menus. */
export function MediaMenuItem({ icon, label, trailing, onClick, disabled }: MediaMenuItemProps) {
  return (
    <MenuItem>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onClick(e)
        }}
        className={CONTEXT_MENU_ITEM_CLASS}
      >
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {trailing}
      </button>
    </MenuItem>
  )
}

export function MediaMenuDivider() {
  return <div className="my-1 h-px bg-secondary/20" />
}
