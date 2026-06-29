import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { useAuthPromptStore } from '@/stores/authPromptStore'

const EXIT_MS = 180

export function AuthPromptModal() {
  const { isOpen, title, imageUrl, close } = useAuthPromptStore()
  const [rendered, setRendered] = useState(isOpen)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const frame = window.requestAnimationFrame(() => {
        setRendered(true)
        setClosing(false)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    if (!rendered) return undefined

    const frame = window.requestAnimationFrame(() => setClosing(true))
    const timeout = window.setTimeout(() => setRendered(false), EXIT_MS)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [isOpen, rendered])

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(close, EXIT_MS - 40)
  }

  if (!rendered) return null

  return (
    <Dialog
      open={rendered}
      onClose={requestClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm ${
        closing ? 'animate-auth-overlay-out' : 'animate-auth-overlay-in'
      }`}
    >
      <DialogPanel
        className={`relative grid w-full max-w-3xl grid-cols-1 gap-8 rounded-lg bg-gradient-to-b from-elevated to-surface p-8 shadow-2xl sm:grid-cols-[minmax(220px,300px)_1fr] sm:p-10 ${
          closing ? 'animate-auth-card-out' : 'animate-auth-card-in'
        }`}
      >
        <button
          onClick={requestClose}
          className="absolute right-4 top-4 rounded-full p-1 text-secondary transition-colors hover:bg-surface hover:text-primary"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div
          className={`hidden overflow-hidden rounded-md bg-base shadow-xl sm:block ${
            closing ? 'animate-auth-art-out' : 'animate-auth-art-in'
          }`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="aspect-square h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-square h-full w-full items-center justify-center">
              <SpotifyMark className="h-40 w-40 text-accent" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center text-center sm:text-left">
          <DialogTitle className="pr-8 text-3xl font-bold leading-tight text-primary sm:pr-0">
            {title}
          </DialogTitle>
          <div className="mt-8 flex flex-col items-center gap-4 sm:items-start">
            <Link
              to="/signup"
              onClick={requestClose}
              className="rounded-full bg-accent px-9 py-3 text-sm font-bold text-black transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
            >
              Sign up free
            </Link>
            <button className="rounded-full border border-secondary/60 px-9 py-3 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95">
              Download app
            </button>
          </div>
          <p className="mt-8 text-sm font-semibold text-secondary">
            Already have an account?{' '}
            <Link to="/login" onClick={requestClose} className="text-primary underline hover:text-accent">
              Log in
            </Link>
          </p>
        </div>
      </DialogPanel>
    </Dialog>
  )
}
