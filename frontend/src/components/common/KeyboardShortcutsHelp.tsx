import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Space'], label: 'Play / pause' },
  { keys: ['←', '→'], label: 'Seek −5s / +5s' },
  { keys: ['Ctrl', '← / →'], label: 'Previous / next track' },
  { keys: ['Shift', '↑ / ↓'], label: 'Volume up / down' },
  { keys: ['M'], label: 'Mute / unmute' },
  { keys: ['L'], label: 'Like / unlike current track' },
  { keys: ['?'], label: 'Show this help' },
]

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded border border-secondary/40 bg-elevated px-1.5 py-0.5 text-xs font-semibold text-primary">
      {children}
    </kbd>
  )
}

/**
 * Shows a keyboard-shortcuts cheat sheet when the user presses "?".
 * Self-contained: owns its own key listener (ignored while typing) and modal.
 */
export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md rounded-xl border border-secondary/10 bg-elevated p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Keyboard shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-1 text-secondary transition-colors hover:bg-surface hover:text-primary"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <ul className="space-y-2.5">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-secondary">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <Key key={i}>{k}</Key>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Shortcuts are ignored while typing in a text field.</p>
      </div>
    </div>
  )
}
